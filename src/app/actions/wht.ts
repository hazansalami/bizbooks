"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/auth";
import { autoMatchCredits, parseCreditCsv } from "@/lib/wht";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { money, naira, parseAmount, round2 } from "@/lib/money";
import { addDays, dateOrNull, formatDate, greetingName, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

const done = () => { revalidatePath("/app/wht"); };

/** Opt in (or out). Nothing is tracked or sent to clients until the owner turns this on. */
export async function setWhtTracking(form: FormData) {
  const { business } = await requireBusiness();
  const on = str(form, "on") === "1";
  await db.business.update({ where: { id: business.id }, data: { whtTracking: on } });
  revalidatePath("/app", "layout");
  redirect(on ? "/app/wht" : "/app/taxes");
}

/** Upload the WHT credit list exported from TaxPro-Max (CSV). Duplicates (same receipt number) are skipped. */
export async function importWhtCredits(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose the CSV file you exported from TaxPro-Max." };
  if (file.size > 2_000_000) return { message: "That file is over 2 MB. Export a shorter date range and upload it in parts." };
  const parsed = parseCreditCsv(await file.text());
  if (parsed.error) return { message: parsed.error };
  if (!parsed.credits.length) return { message: "No credits found in that file." };
  let added = 0;
  for (const c of parsed.credits) {
    // Rows without a receipt number can't be de-duplicated by reference, so match on everything instead.
    const exists = c.reference
      ? await db.whtCredit.findFirst({ where: { businessId: business.id, source: "TAXPROMAX", reference: c.reference } })
      : await db.whtCredit.findFirst({ where: { businessId: business.id, payerName: c.payerName, amount: c.amount, date: c.date } });
    if (exists) continue;
    await db.whtCredit.create({ data: { businessId: business.id, source: "TAXPROMAX", ...c } });
    added++;
  }
  const matched = await autoMatchCredits(business.id);
  done();
  return {
    ok: true,
    message: `Imported ${added} credit${added === 1 ? "" : "s"}${parsed.credits.length > added ? ` (${parsed.credits.length - added} already here)` : ""}, and matched ${matched} to invoices.${parsed.skipped ? ` ${parsed.skipped} row${parsed.skipped === 1 ? "" : "s"} without a payer, amount or date ${parsed.skipped === 1 ? "was" : "were"} skipped.` : ""}`,
  };
}

/** Add one credit by hand, e.g. from a credit note a client emailed. */
export async function addWhtCredit(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const values = { payerName: str(form, "payerName"), amount: str(form, "amount"), date: str(form, "date"), reference: str(form, "reference"), invoiceId: str(form, "invoiceId") };
  const amount = round2(parseAmount(values.amount));
  const date = dateOrNull(form, "date");
  const errors: Record<string, string> = {};
  if (values.payerName.length < 2) errors.payerName = "Who deducted it?";
  if (!(amount > 0)) errors.amount = "Enter the amount on the credit note.";
  if (!date) errors.date = "Enter the date on the credit note.";
  if (Object.keys(errors).length) return { errors, values };
  const invoice = values.invoiceId ? await db.invoice.findFirst({ where: { id: values.invoiceId, businessId: business.id } }) : null;
  await db.whtCredit.create({ data: { businessId: business.id, source: "MANUAL", payerName: values.payerName.slice(0, 200), amount, date: date!, reference: values.reference.slice(0, 100) || null, invoiceId: invoice?.id ?? null } });
  if (!invoice) await autoMatchCredits(business.id);
  done();
  return { ok: true, message: "Credit added." };
}

/** Link a credit to the invoice it covers (or unlink with an empty invoice). */
export async function matchWhtCredit(form: FormData) {
  const { business } = await requireBusiness();
  const credit = await db.whtCredit.findFirst({ where: { id: str(form, "creditId"), businessId: business.id } });
  if (!credit) return;
  const invoiceId = str(form, "invoiceId");
  const invoice = invoiceId ? await db.invoice.findFirst({ where: { id: invoiceId, businessId: business.id } }) : null;
  await db.whtCredit.update({ where: { id: credit.id }, data: { invoiceId: invoice?.id ?? null } });
  done();
}

export async function deleteWhtCredit(form: FormData) {
  const { business } = await requireBusiness();
  await db.whtCredit.deleteMany({ where: { id: str(form, "creditId"), businessId: business.id } });
  done();
}

/**
 * Ask the client to remit the WHT they deducted, or send the credit note. Polite, specific (invoice, date,
 * amount, our TIN) and at most once a week per invoice.
 */
export async function chaseWht(_: FormState, form: FormData): Promise<FormState> {
  const { business } = await requireBusiness();
  const inv = await db.invoice.findFirst({ where: { id: str(form, "invoiceId"), businessId: business.id, whtAmount: { gt: 0 } }, include: { customer: true } });
  if (!inv) return { message: "Invoice not found." };
  if (!business.whtTracking) return { message: "Turn on WHT tracking first." };
  if (inv.whtChasedAt && inv.whtChasedAt > addDays(new Date(), -7)) return { message: `You asked ${inv.customer.name} on ${formatDate(inv.whtChasedAt)}. Give them a few more days.` };
  if (!inv.customer.email) return { message: `${inv.customer.name} has no email address. Use the WhatsApp button instead, or add their email on the client page.` };
  const amount = money(inv.whtAmount, inv.currency);
  const { html, text } = layout({
    heading: `Withholding tax on invoice ${inv.number}`,
    paragraphs: [
      `Hello ${esc(greetingName(inv.customer.name))},`,
      `Thank you for paying invoice <strong>${esc(inv.number)}</strong>${inv.paidAt ? ` on ${formatDate(inv.paidAt)}` : ""}. Your team deducted <strong>${esc(amount)}</strong> withholding tax from the payment.`,
      `We can't yet see it remitted under our TIN on TaxPro-Max. Could you send us the WHT credit note or receipt, or let us know when it will be remitted?`,
      `Our details: <strong>${esc(business.legalName || business.name)}</strong>${business.tin ? `, TIN <strong>${esc(business.tin)}</strong>` : ""}${business.rcNumber ? `, RC ${esc(business.rcNumber)}` : ""}.`,
      `Thank you,<br>${esc(business.name)}`,
    ],
    footer: esc(business.name),
  });
  const r = await sendEmail({ to: inv.customer.email, subject: `WHT credit note for invoice ${inv.number} (${naira(round2(inv.whtAmount * inv.exchangeRate))})`, html, text, replyTo: business.email, fromName: business.name });
  if (!r.ok) return { message: "We couldn't send the email just now. Try again in a minute." };
  await db.$transaction([
    db.invoice.update({ where: { id: inv.id }, data: { whtChasedAt: new Date() } }),
    db.invoiceEvent.create({ data: { invoiceId: inv.id, type: "NOTE", note: `Asked for the WHT credit note (${amount})` } }),
  ]);
  done();
  return { ok: true, message: `Asked ${inv.customer.name} for the credit note on ${inv.number}.` };
}
