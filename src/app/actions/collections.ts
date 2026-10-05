"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { balanceDue, money, parseAmount, round2 } from "@/lib/money";
import { dateOrNull, formatDate, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

/** Log a client's promise to pay ("we'll pay on Friday"). The forecast expects it then; the daily job chases if it slips. */
export async function addPaymentPromise(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const inv = await db.invoice.findFirst({ where: { id: str(form, "id"), businessId: business.id, kind: "INVOICE" } });
  if (!inv) return { message: "Invoice not found." };
  const values = { promisedFor: str(form, "promisedFor"), amount: str(form, "amount"), note: str(form, "note") };
  const due = balanceDue(inv);
  const amount = round2(parseAmount(values.amount) || due);
  const promisedFor = dateOrNull(form, "promisedFor");
  if (!promisedFor) return { errors: { promisedFor: "When did they say they'll pay?" }, values };
  if (!(amount > 0) || amount > due + 0.005) return { errors: { amount: `Enter up to the ${money(due, inv.currency)} still owed.` }, values };
  await db.$transaction([
    // One live promise per invoice: a new date replaces the old one.
    db.paymentPromise.updateMany({ where: { invoiceId: inv.id, status: "OPEN" }, data: { status: "CANCELLED" } }),
    db.paymentPromise.create({ data: { businessId: business.id, invoiceId: inv.id, amount, promisedFor, note: values.note.slice(0, 300) || null } }),
    db.invoiceEvent.create({ data: { invoiceId: inv.id, type: "PROMISE", note: `Promised ${money(amount, inv.currency)} by ${formatDate(promisedFor)}${values.note ? ` · ${values.note.slice(0, 100)}` : ""}` } }),
  ]);
  revalidatePath(`/app/invoices/${inv.id}`);
  revalidatePath("/app/forecast");
  return { ok: true, message: `Logged. We'll expect ${money(amount, inv.currency)} by ${formatDate(promisedFor)} and remind them if it doesn't arrive.` };
}

export async function cancelPaymentPromise(form: FormData) {
  const { business } = await requireBusiness();
  const p = await db.paymentPromise.findFirst({ where: { id: str(form, "promiseId"), businessId: business.id, status: "OPEN" } });
  if (!p) return;
  await db.paymentPromise.update({ where: { id: p.id }, data: { status: "CANCELLED" } });
  revalidatePath(`/app/invoices/${p.invoiceId}`);
  revalidatePath("/app/forecast");
}
