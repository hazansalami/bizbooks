"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { advance, runSchedule } from "@/lib/recurring";
import { isPro } from "@/lib/plan";
import { FREE_RECURRING_LIMIT, FREQUENCIES } from "@/lib/constants";
import { parseAmount, round2 } from "@/lib/money";
import { isCurrency } from "@/lib/currency";
import { addDays, dateOrNull, startOfDay, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

export async function saveSchedule(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const errors: Record<string, string> = {};
  const id = str(form, "id");

  if (!id && !isPro(business)) {
    const active = await db.recurringSchedule.count({ where: { businessId: business.id, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (active >= FREE_RECURRING_LIMIT) {
      return { message: `The Free plan includes ${FREE_RECURRING_LIMIT} recurring invoices. Upgrade to Pro for unlimited, or end one you no longer need.`, values };
    }
  }

  let customerId = str(form, "customerId");
  // "+ Add a new client" (or no clients yet): created below, once everything else checks out.
  const newClient = customerId === "new" || !customerId;
  if (newClient) {
    if (str(form, "newCustomerName").length < 2) errors.customerId = "Enter the client's name.";
  } else if (!(await db.customer.findFirst({ where: { id: customerId, businessId: business.id } }))) errors.customerId = "Choose a client.";
  const title = str(form, "title");
  if (title.length < 2) errors.title = "Give it a short name, e.g. “Monthly shop rent”.";
  const frequency = str(form, "frequency");
  if (!(frequency in FREQUENCIES)) errors.frequency = "Choose how often.";
  const startAt = dateOrNull(form, "startAt");
  if (!startAt) errors.startAt = "Choose the date of the first invoice.";
  // A past start date backfills the invoices for the periods already gone (see below), up to a year back.
  else if (startAt < addDays(startOfDay(new Date()), -366)) errors.startAt = "Start within the last year. For older invoices, import them instead.";
  const ends = str(form, "ends");
  const maxRuns = ends === "after" ? Math.round(Number(str(form, "maxRuns"))) : null;
  const endAt = ends === "on" ? dateOrNull(form, "endAt") : null;
  if (ends === "after" && !(maxRuns && maxRuns > 0)) errors.maxRuns = "Enter how many invoices to send.";
  if (ends === "on" && !endAt) errors.endAt = "Choose the last date.";
  else if (endAt && startAt && endAt < startAt) errors.endAt = "The last date can't be before the first invoice.";

  let items: { description: string; details: string | null; quantity: number; unitPrice: number }[] = [];
  try {
    items = (JSON.parse(str(form, "items") || "[]") as { description: string; details?: string; quantity: string; unitPrice: string }[])
      .map((l) => ({ description: String(l.description).trim(), details: String(l.details ?? "").trim().slice(0, 4000) || null, quantity: parseAmount(String(l.quantity)), unitPrice: round2(parseAmount(String(l.unitPrice))) }))
      .filter((l) => l.description);
  } catch {}
  if (!items.length || items.some((l) => !(l.quantity > 0) || !(l.unitPrice >= 0))) errors.items = "Add at least one item with a quantity and price.";
  const currency = isCurrency(str(form, "currency")) ? str(form, "currency") : "NGN";
  const exchangeRate = currency === "NGN" ? 1 : parseAmount(str(form, "exchangeRate"));
  if (currency !== "NGN" && !(exchangeRate > 0)) errors.exchangeRate = `Enter how many naira 1 ${currency} is worth.`;
  if (Object.keys(errors).length) return { errors, values };

  if (newClient) {
    const email = str(form, "newCustomerEmail").toLowerCase();
    customerId = (await db.customer.create({
      data: { businessId: business.id, name: str(form, "newCustomerName"), phone: str(form, "newCustomerPhone") || null, email: /^\S+@\S+\.\S+$/.test(email) ? email : null, currency: currency === "NGN" ? null : currency },
    })).id;
  }

  const data = {
    customerId, title, frequency, items, endAt, maxRuns,
    autoSend: str(form, "autoSend") === "on",
    dueInDays: [0, 7, 14, 30].includes(Number(str(form, "dueInDays"))) ? Number(str(form, "dueInDays")) : business.paymentTermsDays,
    vatRate: str(form, "applyVat") === "on" ? business.vatRate : 0,
    whtRate: [0, 2, 5, 10].includes(Number(str(form, "whtRate"))) ? Number(str(form, "whtRate")) : 0,
    notes: str(form, "notes") || null,
    currency, exchangeRate,
  };
  let scheduleId = id;
  if (id) {
    const s = await db.recurringSchedule.findFirst({ where: { id, businessId: business.id } });
    if (!s) return { message: "Schedule not found." };
    await db.recurringSchedule.update({ where: { id }, data: { ...data, nextRunAt: s.runs === 0 ? startAt! : s.nextRunAt } });
    if (s.runs === 0) await catchUp(scheduleId);
  } else {
    scheduleId = (await db.recurringSchedule.create({ data: { ...data, businessId: business.id, nextRunAt: startAt! } })).id;
    await catchUp(scheduleId);
  }
  revalidatePath("/app/recurring");
  redirect(`/app/recurring/${scheduleId}`);
}

/**
 * Backdated start: create the invoices for every period already gone, each on its own date and not
 * emailed, then today's (which goes out as normal). Future periods are left to the daily run.
 */
async function catchUp(scheduleId: string) {
  const today = startOfDay(new Date());
  for (let i = 0; i < 400; i++) {
    const s = await db.recurringSchedule.findUnique({ where: { id: scheduleId }, select: { status: true, nextRunAt: true } });
    if (!s || s.status !== "ACTIVE" || startOfDay(s.nextRunAt) > today) return;
    const past = startOfDay(s.nextRunAt) < today;
    if (!(await runSchedule(scheduleId, { backdated: past }))) return;
  }
}

export async function setScheduleStatus(form: FormData) {
  const { business } = await requireBusiness();
  const s = await db.recurringSchedule.findFirst({ where: { id: str(form, "id"), businessId: business.id } });
  if (!s) return;
  const status = str(form, "status");
  if (!["ACTIVE", "PAUSED", "ENDED"].includes(status)) return;
  // Resuming after a long pause: don't fire a backlog of missed invoices.
  let nextRunAt = s.nextRunAt;
  if (status === "ACTIVE") while (nextRunAt < startOfDay(new Date())) nextRunAt = advance(nextRunAt, s.frequency);
  await db.recurringSchedule.update({ where: { id: s.id }, data: { status, nextRunAt } });
  revalidatePath(`/app/recurring/${s.id}`);
}

export async function sendNextNow(form: FormData) {
  const { business } = await requireBusiness();
  const s = await db.recurringSchedule.findFirst({ where: { id: str(form, "id"), businessId: business.id, status: "ACTIVE" } });
  if (!s) return;
  const inv = await runSchedule(s.id);
  if (inv) redirect(`/app/invoices/${inv.id}?share=1`);
}
