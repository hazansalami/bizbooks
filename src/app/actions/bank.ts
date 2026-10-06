"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { importLines, parseStatementCsv, vendorFrom } from "@/lib/bank";
import { applyPayment } from "@/lib/invoices";
import { monoConfigured, startMonoLink, syncConnection, unlinkConnection } from "@/lib/mono";
import { balanceDue, money, round2 } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

const done = () => revalidatePath("/app/bank");

async function ownLine(id: string) {
  const { business } = await requireBusiness();
  const t = await db.bankTransaction.findFirst({ where: { id, businessId: business.id } });
  return { business, t };
}

export async function importBankStatement(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose the statement file (CSV)." };
  if (file.size > 3_000_000) return { message: "That file is over 3 MB. Download a shorter period and upload it in parts." };
  if (/\.(xlsx?|pdf)$/i.test(file.name)) return { message: "That's an Excel or PDF file. Open it and save it as CSV, or download the CSV version from your bank, then upload that." };
  const parsed = parseStatementCsv(await file.text());
  if (parsed.error) return { message: parsed.error };
  if (!parsed.lines.length) return { message: "No transactions found in that file." };
  const r = await importLines(business.id, parsed.lines, { source: "CSV", account: str(form, "account").slice(0, 60) || null });
  done();
  revalidatePath("/app/forecast");
  return {
    ok: true,
    message: `Imported ${r.added} line${r.added === 1 ? "" : "s"}${r.duplicates ? ` (${r.duplicates} already here)` : ""}. ${r.matched} matched to what's already in your books${r.suggested ? `, ${r.suggested} with a likely match to confirm` : ""}.`,
  };
}

/** One tap: the line is the payment for the suggested invoice, or pays the suggested bill. */
export async function confirmBankSuggestion(form: FormData) {
  const { business, t } = await ownLine(str(form, "id"));
  if (!t || t.status !== "UNMATCHED" || !t.suggestedId) return;
  if (t.amount > 0) await recordCredit(business.id, t, t.suggestedId);
  else {
    const bill = await db.expense.findFirst({ where: { id: t.suggestedId, businessId: business.id, paid: false } });
    if (bill) {
      await db.$transaction([
        db.expense.update({ where: { id: bill.id }, data: { paid: true, paidAt: t.date } }),
        db.bankTransaction.update({ where: { id: t.id }, data: { status: "MATCHED", expenseId: bill.id } }),
      ]);
    }
  }
  done();
}

async function recordCredit(businessId: string, t: { id: string; amount: number; date: Date; description: string }, invoiceId: string) {
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, businessId, kind: "INVOICE", currency: "NGN" } });
  if (!inv) return "Invoice not found.";
  const due = balanceDue(inv);
  if (t.amount > due + 1) return `That's more than the ${money(due, inv.currency)} still owed on ${inv.number}.`;
  const r = await applyPayment(inv.id, { amount: Math.min(t.amount, due), method: "BANK_TRANSFER", paidAt: t.date, note: `From bank statement: ${t.description}`.slice(0, 300) });
  if (!r.ok) return r.error;
  await db.bankTransaction.update({ where: { id: t.id }, data: { status: "MATCHED", paymentId: r.paymentId ?? null } });
  revalidatePath(`/app/invoices/${inv.id}`);
  return null;
}

/** Money in: record it against the invoice the owner picks. */
export async function bankLineToPayment(_: FormState, form: FormData): Promise<FormState> {
  const { business, t } = await ownLine(str(form, "id"));
  if (!t || t.status !== "UNMATCHED" || t.amount <= 0) return { message: "This line is already sorted." };
  const invoiceId = str(form, "invoiceId");
  if (!invoiceId) return { message: "Choose the invoice this payment is for." };
  const err = await recordCredit(business.id, t, invoiceId);
  if (err) return { message: err };
  done();
  return { ok: true };
}

/** Money out: add it as a paid expense in the category picked. */
export async function bankLineToExpense(_: FormState, form: FormData): Promise<FormState> {
  const { business, t } = await ownLine(str(form, "id"));
  if (!t || t.status !== "UNMATCHED" || t.amount >= 0) return { message: "This line is already sorted." };
  const category = str(form, "category");
  if (!EXPENSE_CATEGORIES.includes(category)) return { message: "Pick what it was for." };
  const e = await db.expense.create({
    data: {
      businessId: business.id, date: t.date, amount: round2(-t.amount), category, vendor: vendorFrom(t.description),
      note: t.description.slice(0, 300), method: /\bpos\b/i.test(t.description) ? "POS" : "BANK_TRANSFER", paid: true, paidAt: t.date,
    },
  });
  await db.bankTransaction.update({ where: { id: t.id }, data: { status: "MATCHED", expenseId: e.id } });
  done();
  revalidatePath("/app/expenses");
  return { ok: true };
}

/** Transfers between your own accounts, loans, owner top-ups: not income or spending. */
export async function ignoreBankLine(form: FormData) {
  const { t } = await ownLine(str(form, "id"));
  if (t && t.status === "UNMATCHED") await db.bankTransaction.update({ where: { id: t.id }, data: { status: "IGNORED" } });
  done();
}

/** Back to "to review". The payment or expense it was matched to stays in the books. */
export async function reopenBankLine(form: FormData) {
  const { t } = await ownLine(str(form, "id"));
  if (t) await db.bankTransaction.update({ where: { id: t.id }, data: { status: "UNMATCHED", paymentId: null, expenseId: null, suggestedId: null } });
  done();
}

/** Clears every line still to review: for the first import, when old history doesn't need sorting. */
export async function ignoreAllBankLines(form: FormData) {
  const { business } = await requireBusiness();
  const before = str(form, "before");
  await db.bankTransaction.updateMany({
    where: { businessId: business.id, status: "UNMATCHED", ...(before ? { date: { lt: new Date(`${before}T00:00:00`) } } : {}) },
    data: { status: "IGNORED" },
  });
  done();
}

export async function connectBank() {
  const { user, business } = await requireBusiness();
  if (!monoConfigured()) redirect("/app/bank");
  const url = await startMonoLink(business, user.email);
  redirect(url);
}

export async function syncBankNow(form: FormData) {
  const { business } = await requireBusiness();
  const c = await db.bankConnection.findFirst({ where: { id: str(form, "id"), businessId: business.id } });
  if (c) await syncConnection(c.id).catch(() => null);
  done();
}

export async function disconnectBank(form: FormData) {
  const { business } = await requireBusiness();
  const c = await db.bankConnection.findFirst({ where: { id: str(form, "id"), businessId: business.id } });
  if (c) await unlinkConnection(c.id);
  done();
}
