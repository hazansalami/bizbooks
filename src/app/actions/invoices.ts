"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { applyPayment, createInvoice, emailInvoice, loadFullInvoice, markSent, refreshInvoicePaid } from "@/lib/invoices";
import { computeTotals, parseAmount, round2, type LineInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/constants";
import { isPro } from "@/lib/plan";
import { dateOrNull, str } from "@/lib/utils";
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
    .map((l) => ({ description: String(l?.description ?? "").trim(), quantity: parseAmount(String(l?.quantity ?? "")), unitPrice: parseAmount(String(l?.unitPrice ?? "")) }))
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
  const poNumber = str(form, "poNumber") || null;
  const depositRaw = Number(str(form, "depositPercent"));
  const depositPercent = kind === "QUOTE" && isPro(business) && depositRaw > 0 && depositRaw < 100 ? Math.round(depositRaw) : null;

  if (Object.keys(errors).length) return { errors, values };

  if (customerId === "new" || !customerId) {
    const phone = str(form, "newCustomerPhone");
    const email = str(form, "newCustomerEmail").toLowerCase();
    customerId = (await db.customer.create({ data: { businessId: business.id, name: str(form, "newCustomerName"), phone: phone || null, email: email || null } })).id;
  }

  const notes = str(form, "notes") || null;
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
          whtRate, whtAmount: t.whtAmount, total: t.total, notes, poNumber, depositPercent: inv.kind === "QUOTE" ? depositPercent : null,
          items: { create: lines.map((l, i) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: round2(l.quantity * l.unitPrice), position: i })) },
        },
      }),
    ]);
  } else {
    invoiceId = (await createInvoice({ businessId: business.id, customerId, kind, issueDate, dueDate: dueDate!, lines, discount, vatRate, whtRate, notes, poNumber, depositPercent })).id;
  }

  // Remember new line items so they autocomplete next time.
  const known = new Set((await db.item.findMany({ where: { businessId: business.id }, select: { name: true } })).map((i) => i.name.toLowerCase()));
  const fresh = lines.filter((l) => !known.has(l.description.toLowerCase()));
  if (fresh.length) await db.item.createMany({ data: fresh.map((l) => ({ businessId: business.id, name: l.description, unitPrice: l.unitPrice })) });

  revalidatePath("/app/invoices");
  revalidatePath("/app/quotes");
  redirect(`/app/invoices/${invoiceId}${str(form, "intent") === "send" ? "?share=1" : ""}`);
}

export async function emailInvoiceAction(_: FormState, form: FormData): Promise<FormState> {
  const { inv } = await ownInvoice(str(form, "id"));
  const full = await loadFullInvoice(inv.id);
  const r = await emailInvoice(full!, str(form, "kind") === "reminder" ? "reminder" : "send");
  revalidatePath(`/app/invoices/${inv.id}`);
  return r.ok ? { ok: true, message: `Sent to ${full!.customer.email}.` } : { message: r.error };
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
  const r = await applyPayment(inv.id, { amount, method, paidAt: dateOrNull(form, "paidAt") ?? new Date(), note: str(form, "note") || null });
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
    lines: items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })),
    discount: inv.discount, vatRate: inv.vatRate, whtRate: inv.whtRate, notes: inv.notes, depositPercent: inv.depositPercent,
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
  const lines = items.map((i) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice }));
  // The deposit was already invoiced (with its own VAT), so credit it here and the final invoice carries the balance.
  for (const d of deposits) lines.push({ description: `Less deposit invoiced on ${d.number}`, quantity: 1, unitPrice: -(d.subtotal - d.discount) });
  const issue = new Date();
  const created = await db.$transaction(async (tx) => {
    const n = await createInvoice({
      businessId: business.id, customerId: inv.customerId, kind: "INVOICE", issueDate: issue,
      dueDate: new Date(issue.getTime() + business.paymentTermsDays * 86400000),
      lines, discount: inv.discount, vatRate: inv.vatRate, whtRate: inv.whtRate, notes: inv.notes, convertedFromId: inv.id, poNumber: inv.poNumber,
    }, tx);
    await tx.invoice.update({ where: { id: inv.id }, data: { status: "CONVERTED", events: { create: { type: "CONVERTED", note: n.number } } } });
    return n;
  });
  redirect(`/app/invoices/${created.id}?share=1`);
}
