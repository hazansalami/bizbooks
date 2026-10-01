"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { applyPayment, createInvoice, emailInvoice, loadFullInvoice, markSent, refreshInvoicePaid } from "@/lib/invoices";
import { balanceDue, computeTotals, parseAmount, round2, type LineInput } from "@/lib/money";
import { FREE_RECURRING_LIMIT, FREQUENCIES, PAYMENT_METHODS } from "@/lib/constants";
import { advance } from "@/lib/recurring";
import { isCurrency } from "@/lib/currency";
import { isPro } from "@/lib/plan";
import { dateOrNull, formatDate, str } from "@/lib/utils";
import { z } from "zod";
import type { FormState } from "@/components/form-bits";

async function ownInvoice(id: string) {
  const { business } = await requireBusiness();
  const inv = await db.invoice.findFirst({ where: { id, businessId: business.id } });
  if (!inv) redirect("/app/invoices");
  return { business, inv };
}

function parseLines(raw: string): { lines: LineInput[]; error?: string } {
  let data: unknown;
  try {
    data = JSON.parse(raw || "[]");
  } catch {
    return { lines: [], error: "Something went wrong reading your items. Please try again." };
  }
  if (!Array.isArray(data)) return { lines: [], error: "Add at least one item." };
  const lines = data
    .map((l) => ({ description: String(l?.description ?? "").trim(), details: String(l?.details ?? "").trim().slice(0, 4000) || null, quantity: parseAmount(String(l?.quantity ?? "")), unitPrice: parseAmount(String(l?.unitPrice ?? "")) }))
    .filter((l) => l.description || l.unitPrice);
  if (!lines.length) return { lines, error: "Add at least one item with a price." };
  for (const l of lines) {
    if (!l.description) return { lines, error: "Every item needs a description." };
    if (!(l.quantity > 0)) return { lines, error: `Check the quantity for “${l.description}”.` };
    // Negative prices are allowed for credit lines, e.g. "Less deposit already paid".
    if (!Number.isFinite(l.unitPrice)) return { lines, error: `Check the price for “${l.description}”.` };
  }
  return { lines: lines.map((l) => ({ ...l, unitPrice: round2(l.unitPrice) })) };
}

export async function saveInvoice(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const errors: Record<string, string> = {};
  const values = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const kind = str(form, "kind") === "QUOTE" ? "QUOTE" : "INVOICE";

  // Customer: pick an existing one or create on the spot.
  let customerId = str(form, "customerId");
  if (customerId === "new" || !customerId) {
    const name = str(form, "newCustomerName");
    if (name.length < 2) errors.customer = "Choose a client or type a new client's name.";
  } else if (!(await db.customer.findFirst({ where: { id: customerId, businessId: business.id } }))) {
    errors.customer = "Choose a client.";
  }

  const issueDate = dateOrNull(form, "issueDate") ?? new Date();
  const dueDate = dateOrNull(form, "dueDate");
  if (!dueDate) errors.dueDate = "Choose when payment is due.";
  else if (dueDate < new Date(issueDate.toDateString())) errors.dueDate = "The due date can't be before the invoice date.";

  const { lines, error: linesError } = parseLines(str(form, "items"));
  if (linesError) errors.items = linesError;

  const discount = parseAmount(str(form, "discount")) || 0;
  const vatRate = str(form, "applyVat") === "on" ? business.vatRate : 0;
  const whtRate = [0, 2, 5, 10].includes(Number(str(form, "whtRate"))) ? Number(str(form, "whtRate")) : 0;
  if (discount < 0) errors.discount = "Discount can't be negative.";
  if (!errors.items && computeTotals(lines, discount, 0, 0).subtotal < 0) errors.items = "The total can't be below zero.";
  const currency = isCurrency(str(form, "currency")) ? str(form, "currency") : "NGN";
  const exchangeRate = currency === "NGN" ? 1 : parseAmount(str(form, "exchangeRate"));
  if (currency !== "NGN" && !(exchangeRate > 0)) errors.exchangeRate = `Enter how many naira 1 ${currency} is worth, so your reports stay accurate.`;
  const poNumber = str(form, "poNumber") || null;
  const depositRaw = Number(str(form, "depositPercent"));
  const depositPercent = kind === "QUOTE" && isPro(business) && depositRaw > 0 && depositRaw < 100 ? Math.round(depositRaw) : null;

  // "Make it recurring" (new invoices only): this invoice is the first; a schedule sends the rest.
  const repeat = kind === "INVOICE" && !str(form, "id") && str(form, "repeat") === "on";
  const frequency = str(form, "frequency") in FREQUENCIES ? str(form, "frequency") : "MONTHLY";
  const maxRunsRaw = parseInt(str(form, "maxRuns"), 10);
  const maxRuns = Number.isFinite(maxRunsRaw) && maxRunsRaw > 0 ? maxRunsRaw : null;
  if (repeat && maxRuns === 1) errors.maxRuns = "A recurring invoice needs at least 2 invoices. Choose “Just this once” instead.";
  if (repeat && !isPro(business)) {
    const live = await db.recurringSchedule.count({ where: { businessId: business.id, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (live >= FREE_RECURRING_LIMIT) errors.maxRuns = `The Free plan includes ${FREE_RECURRING_LIMIT} recurring invoices. Upgrade to Pro for unlimited, or choose “Just this once”.`;
  }

  if (Object.keys(errors).length) return { errors, values };

  if (customerId === "new" || !customerId) {
    const phone = str(form, "newCustomerPhone");
    const email = str(form, "newCustomerEmail").toLowerCase();
    customerId = (await db.customer.create({ data: { businessId: business.id, name: str(form, "newCustomerName"), phone: phone || null, email: email || null, currency: currency === "NGN" ? null : currency } })).id;
  } else if (currency !== "NGN") {
    // Remember a client's currency the first time they're billed in it.
    await db.customer.updateMany({ where: { id: customerId, businessId: business.id, currency: null }, data: { currency } });
  }

  const notes = str(form, "notes") || null;
  const title = str(form, "title").slice(0, 120) || null;
  const summary = str(form, "summary").slice(0, 300) || null;
  const id = str(form, "id");
  let invoiceId = id;
  if (id) {
    const inv = await db.invoice.findFirst({ where: { id, businessId: business.id } });
    if (!inv) return { message: "Invoice not found." };
    if (inv.amountPaid > 0 || inv.status === "VOID") return { message: "Invoices with payments can't be edited. Cancel it and create a new one instead." };
    const t = computeTotals(lines, discount, vatRate, whtRate);
    await db.$transaction([
      db.invoiceItem.deleteMany({ where: { invoiceId: id } }),
      db.invoice.update({
        where: { id },
        data: {
          customerId, issueDate, dueDate: dueDate!, subtotal: t.subtotal, discount: t.discount, vatRate, vatAmount: t.vatAmount,
          whtRate, whtAmount: t.whtAmount, total: t.total, notes, poNumber, title, summary, currency, exchangeRate, depositPercent: inv.kind === "QUOTE" ? depositPercent : null,
          items: { create: lines.map((l, i) => ({ description: l.description, details: l.details, quantity: l.quantity, unitPrice: l.unitPrice, amount: round2(l.quantity * l.unitPrice), position: i })) },
        },
      }),
    ]);
  } else {
    invoiceId = await db.$transaction(async (tx) => {
      let recurringId: string | null = null;
      if (repeat) {
        // First scheduled run: one period after this invoice, and never in the past.
        let next = advance(issueDate, frequency);
        while (next <= new Date()) next = advance(next, frequency);
        const client = await tx.customer.findUnique({ where: { id: customerId }, select: { name: true } });
        recurringId = (await tx.recurringSchedule.create({
          data: {
            businessId: business.id, customerId, title: title || `${client?.name ?? "Client"} · ${FREQUENCIES[frequency].toLowerCase()}`,
            frequency, nextRunAt: next, maxRuns, runs: 1, lastRunAt: new Date(), autoSend: true,
            dueInDays: Math.max(0, Math.round((dueDate!.getTime() - issueDate.getTime()) / 86400000)),
            items: lines.map((l) => ({ description: l.description, details: l.details ?? null, quantity: l.quantity, unitPrice: l.unitPrice })),
            discount, vatRate, whtRate, notes, currency, exchangeRate,
          },
        })).id;
      }
      const created = await createInvoice({ businessId: business.id, customerId, kind, issueDate, dueDate: dueDate!, lines, discount, vatRate, whtRate, notes, poNumber, depositPercent, title, summary, currency, exchangeRate, recurringId }, tx);
      return created.id;
    });
    if (repeat) revalidatePath("/app/recurring");
  }

  // Remember new line items so they autocomplete next time.
  const known = new Set((await db.item.findMany({ where: { businessId: business.id }, select: { name: true } })).map((i) => i.name.toLowerCase()));
  const fresh = lines.filter((l) => l.unitPrice > 0 && !known.has(l.description.toLowerCase()));
  const unique = [...new Map(fresh.map((l) => [l.description.toLowerCase(), l])).values()];
  if (unique.length) await db.item.createMany({ data: unique.map((l) => ({ businessId: business.id, name: l.description, description: l.details, unitPrice: l.unitPrice })) });

  revalidatePath("/app/invoices");
  revalidatePath("/app/quotes");
  redirect(`/app/invoices/${invoiceId}${str(form, "intent") === "send" ? "?share=1" : ""}`);
}

export async function emailInvoiceAction(_: FormState, form: FormData): Promise<FormState> {
  const { inv } = await ownInvoice(str(form, "id"));
  const full = await loadFullInvoice(inv.id);
  const kind = str(form, "kind") === "reminder" ? "reminder" : "send";
  // Recipients typed in the dialog: commas, semicolons or spaces between addresses, at most 5.
  const to = [...new Set(str(form, "to").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const values = { to: str(form, "to"), subject: str(form, "subject"), message: str(form, "message") };
  if (!to.length) return { errors: { to: "Enter at least one email address." }, values };
  const bad = to.find((e) => !z.email().safeParse(e).success);
  if (bad) return { errors: { to: `“${bad}” doesn't look like an email address.` }, values };
  if (to.length > 5) return { errors: { to: "Send to at most 5 addresses at once." }, values };
  if (!values.subject.trim()) return { errors: { subject: "Add a subject." }, values };
  if (!values.message.trim()) return { errors: { message: "Add a message." }, values };
  if (values.message.length > 5000 || values.subject.length > 200) return { message: "That message is too long. Keep it under 5,000 characters.", values };
  // Remember the address on the client if they didn't have one.
  if (!full!.customer.email) await db.customer.update({ where: { id: full!.customerId }, data: { email: to[0] } });
  const { user } = await requireBusiness();
  const cc = str(form, "copyMe") === "on" ? [full!.business.email || user.email].filter((e) => !to.includes(e.toLowerCase())) : undefined;
  const r = await emailInvoice(full!, kind, { to, cc, subject: values.subject, message: values.message });
  revalidatePath(`/app/invoices/${inv.id}`);
  return r.ok ? { ok: true, message: `Sent to ${to.join(", ")}${cc?.length ? `, with a copy to ${cc[0]}` : ""}.` } : { message: r.error, values };
}

/** Called when the owner shares by WhatsApp or copies the link, so the invoice leaves "Draft". */
export async function markSharedAction(form: FormData) {
  const { inv } = await ownInvoice(str(form, "id"));
  const channel = str(form, "channel") || "link";
  const isReminder = str(form, "kind") === "reminder";
  if (isReminder) {
    await db.invoice.update({ where: { id: inv.id }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 }, events: { create: { type: "REMINDER", note: `Shared on ${channel}` } } } });
  } else {
    await markSent(inv.id, `Shared on ${channel}`);
  }
  revalidatePath(`/app/invoices/${inv.id}`);
}

export async function recordPayment(_: FormState, form: FormData): Promise<FormState> {
  const { inv } = await ownInvoice(str(form, "id"));
  const amount = parseAmount(str(form, "amount"));
  const method = str(form, "method");
  const values = { amount: str(form, "amount"), method, note: str(form, "note"), paidAt: str(form, "paidAt") };
  if (!(amount > 0)) return { errors: { amount: "Enter the amount you received." }, values };
  if (!(method in PAYMENT_METHODS)) return { errors: { method: "Choose how they paid." }, values };
  const dayRate = parseAmount(str(form, "exchangeRate"));
  const r = await applyPayment(inv.id, { amount, method, paidAt: dateOrNull(form, "paidAt") ?? new Date(), note: str(form, "note") || null, exchangeRate: dayRate > 0 ? dayRate : undefined });
  if (!r.ok) return { message: r.error, values };
  revalidatePath(`/app/invoices/${inv.id}`);
  return { ok: true, message: r.fullyPaid ? "Payment recorded. This invoice is now fully paid." : "Payment recorded." };
}

export async function deletePayment(form: FormData) {
  const { business } = await requireBusiness();
  const p = await db.payment.findFirst({ where: { id: str(form, "paymentId"), businessId: business.id } });
  if (!p) return;
  await db.payment.delete({ where: { id: p.id } });
  if (p.invoiceId) {
    await refreshInvoicePaid(p.invoiceId);
    revalidatePath(`/app/invoices/${p.invoiceId}`);
  }
}

export async function resolveClaim(form: FormData) {
  const { business } = await requireBusiness();
  const claim = await db.paymentClaim.findFirst({ where: { id: str(form, "claimId"), invoice: { businessId: business.id } } });
  if (!claim || claim.status !== "PENDING") return;
  const confirm = str(form, "decision") === "confirm";
  if (confirm) {
    await applyPayment(claim.invoiceId, { amount: claim.amount, method: "BANK_TRANSFER", paidAt: claim.createdAt, note: `Transfer from ${claim.payerName}` });
  }
  await db.paymentClaim.update({ where: { id: claim.id }, data: { status: confirm ? "CONFIRMED" : "REJECTED" } });
  revalidatePath(`/app/invoices/${claim.invoiceId}`);
  revalidatePath("/app");
}

export async function voidInvoice(form: FormData) {
  const { inv } = await ownInvoice(str(form, "id"));
  await db.invoice.update({ where: { id: inv.id }, data: { status: "VOID", events: { create: { type: "VOID" } } } });
  revalidatePath(`/app/invoices/${inv.id}`);
}

/** Delete any invoice, paid or not, along with its payments. The page asks twice before calling this. */
export async function deleteInvoice(form: FormData) {
  const { inv, business } = await ownInvoice(str(form, "id"));
  await db.$transaction([
    db.payment.deleteMany({ where: { invoiceId: inv.id, businessId: business.id } }),
    db.invoice.delete({ where: { id: inv.id } }),
  ]);
  revalidatePath("/app/invoices");
  revalidatePath("/app/payments");
  revalidatePath("/app");
  redirect(inv.kind === "QUOTE" ? "/app/quotes" : "/app/invoices");
}

export async function deleteDraft(form: FormData) {
  const { inv } = await ownInvoice(str(form, "id"));
  if (inv.status === "DRAFT" && inv.amountPaid === 0) await db.invoice.delete({ where: { id: inv.id } });
  revalidatePath("/app/invoices");
  redirect("/app/invoices");
}

export async function duplicateInvoice(form: FormData) {
  const { business, inv } = await ownInvoice(str(form, "id"));
  const items = await db.invoiceItem.findMany({ where: { invoiceId: inv.id }, orderBy: { position: "asc" } });
  const issue = new Date();
  const copy = await createInvoice({
    businessId: business.id, customerId: inv.customerId, kind: inv.kind as "INVOICE" | "QUOTE", issueDate: issue,
    dueDate: new Date(issue.getTime() + business.paymentTermsDays * 86400000),
    lines: items.map((i) => ({ description: i.description, details: i.details, quantity: i.quantity, unitPrice: i.unitPrice })),
    discount: inv.discount, vatRate: inv.vatRate, whtRate: inv.whtRate, notes: inv.notes, depositPercent: inv.depositPercent,
    title: inv.title, summary: inv.summary, poNumber: inv.poNumber, currency: inv.currency, exchangeRate: inv.exchangeRate,
  });
  redirect(`/app/invoices/${copy.id}/edit`);
}

export async function convertQuote(form: FormData) {
  const { business, inv } = await ownInvoice(str(form, "id"));
  if (inv.kind !== "QUOTE") redirect(`/app/invoices/${inv.id}`);
  const [items, deposits] = await Promise.all([
    db.invoiceItem.findMany({ where: { invoiceId: inv.id }, orderBy: { position: "asc" } }),
    db.invoice.findMany({ where: { depositForId: inv.id, status: { not: "VOID" } } }),
  ]);
  const lines: LineInput[] = items.map((i) => ({ description: i.description, details: i.details, quantity: i.quantity, unitPrice: i.unitPrice }));
  // The deposit was already invoiced (with its own VAT), so credit it here and the final invoice carries the balance.
  for (const d of deposits) lines.push({ description: `Less deposit invoiced on ${d.number}`, quantity: 1, unitPrice: -(d.subtotal - d.discount) });
  const issue = new Date();
  const created = await db.$transaction(async (tx) => {
    const n = await createInvoice({
      businessId: business.id, customerId: inv.customerId, kind: "INVOICE", issueDate: issue,
      dueDate: new Date(issue.getTime() + business.paymentTermsDays * 86400000),
      lines, discount: inv.discount, vatRate: inv.vatRate, whtRate: inv.whtRate, notes: inv.notes, convertedFromId: inv.id, poNumber: inv.poNumber, title: inv.title, summary: inv.summary, currency: inv.currency, exchangeRate: inv.exchangeRate,
    }, tx);
    await tx.invoice.update({ where: { id: inv.id }, data: { status: "CONVERTED", events: { create: { type: "CONVERTED", note: n.number } } } });
    return n;
  });
  redirect(`/app/invoices/${created.id}?share=1`);
}

/**
 * Bulk actions from the invoice list. "delete" removes invoices permanently, but never ones with money
 * recorded against them (that would silently change cash and income figures). "void" cancels them and
 * keeps the record, which is the safer choice for anything a client or the tax office may have seen.
 */
export async function bulkInvoiceAction(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  let ids: string[] = [];
  try {
    ids = (JSON.parse(str(form, "ids") || "[]") as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 500);
  } catch {}
  if (!ids.length) return { message: "Select at least one invoice." };
  const op = str(form, "op");
  const invoices = await db.invoice.findMany({
    where: { id: { in: ids }, businessId: business.id, kind: "INVOICE" },
    select: { id: true, status: true, amountPaid: true, payments: { select: { reference: true } } },
  });
  const plural = (n: number) => `${n} invoice${n === 1 ? "" : "s"}`;

  if (op === "delete") {
    // Invoices with payments (recorded by hand or online) go only when the user confirmed it twice ("withPayments"),
    // and their payments go with them. Deleting never refunds anyone; the client says so before asking.
    const withPayments = str(form, "withPayments") === "1";
    const paid = invoices.filter((i) => i.amountPaid > 0 || i.payments.length > 0);
    const deletable = invoices.filter((i) => withPayments || !paid.includes(i)).map((i) => i.id);
    if (deletable.length) {
      await db.$transaction([
        db.payment.deleteMany({ where: { invoiceId: { in: deletable }, businessId: business.id } }),
        db.invoice.deleteMany({ where: { id: { in: deletable }, businessId: business.id } }),
      ]);
    }
    const keptPaid = withPayments ? 0 : paid.length;
    revalidatePath("/app/invoices");
    revalidatePath("/app/payments");
    revalidatePath("/app");
    return {
      ok: deletable.length > 0,
      message: [
        `Deleted ${plural(deletable.length)}${withPayments && paid.length ? `, including ${paid.length} with payments (those payments were removed too)` : ""}.`,
        keptPaid ? `${plural(keptPaid)} with payments ${keptPaid === 1 ? "was" : "were"} kept.` : "",
      ].filter(Boolean).join(" "),
    };
  }

  if (op === "void") {
    const voidable = invoices.filter((i) => !["VOID", "PAID"].includes(i.status)).map((i) => i.id);
    const skipped = invoices.length - voidable.length;
    if (voidable.length) {
      await db.$transaction([
        db.invoice.updateMany({ where: { id: { in: voidable }, businessId: business.id }, data: { status: "VOID" } }),
        db.invoiceEvent.createMany({ data: voidable.map((invoiceId) => ({ invoiceId, type: "VOID", note: "Cancelled in bulk" })) }),
      ]);
    }
    revalidatePath("/app/invoices");
    revalidatePath("/app");
    return { ok: voidable.length > 0, message: `Cancelled ${plural(voidable.length)}.${skipped ? ` ${plural(skipped)} already paid or cancelled ${skipped === 1 ? "was" : "were"} left as ${skipped === 1 ? "it was" : "they were"}.` : ""}` };
  }
  if (op === "paid") {
    // Record a payment for each invoice's outstanding balance, so cash flow and reports stay right.
    const method = str(form, "method") in PAYMENT_METHODS ? str(form, "method") : "BANK_TRANSFER";
    const paidAt = dateOrNull(form, "paidAt") ?? new Date();
    const open = await db.invoice.findMany({ where: { id: { in: invoices.map((i) => i.id) }, status: { notIn: ["VOID", "PAID"] } } });
    let done = 0;
    for (const inv of open) {
      const due = balanceDue(inv);
      if (due <= 0) continue;
      // One at a time: each payment is its own small transaction (kind to small connection pools).
      const r = await applyPayment(inv.id, { amount: due, method, paidAt, note: "Marked paid in bulk" });
      if (r.ok) done++;
    }
    const skipped = invoices.length - done;
    revalidatePath("/app/invoices");
    revalidatePath("/app/payments");
    revalidatePath("/app");
    return { ok: done > 0, message: `Marked ${plural(done)} as paid on ${formatDate(paidAt)}.${skipped ? ` ${plural(skipped)} already paid or cancelled ${skipped === 1 ? "was" : "were"} skipped.` : ""}` };
  }
  return { message: "Choose what to do with the selected invoices." };
}
