"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createInvoice, loadFullInvoice, markSent, publicInvoiceUrl } from "@/lib/invoices";
import { startInvoiceCheckout } from "@/lib/checkout";
import { computeTotals, money, parseAmount, round2 } from "@/lib/money";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import { addDays, str } from "@/lib/utils";
import type { FormState } from "@/components/form-bits";

async function invoiceByToken(token: string) {
  const found = await db.invoice.findUnique({ where: { publicToken: token }, select: { id: true } });
  return found ? loadFullInvoice(found.id) : null;
}

export async function payNow(_: FormState, form: FormData): Promise<FormState> {
  const inv = await invoiceByToken(str(form, "token"));
  if (!inv) return { message: "This invoice link is no longer valid." };
  const email = (str(form, "email") || inv.customer.email || "").toLowerCase();
  if (!z.email().safeParse(email).success) {
    return { errors: { email: "Enter your email so the payment company can send your receipt." }, values: { email } };
  }
  // Used for this checkout's receipt only. It isn't saved on the client: anyone holding the link could type
  // an address here, and the business's future invoices and reminders would then go to it.
  const r = await startInvoiceCheckout(inv, email);
  if ("error" in r) {
    // The gateway's own wording ("Invalid key") means nothing to a customer; keep it for the logs.
    console.warn(`[checkout] ${inv.businessId} ${inv.number}: ${r.error}`);
    return {
      message: inv.business.bankAccounts.length
        ? "Online payment isn't available right now. You can pay by bank transfer below, or try again later."
        : `Online payment isn't available right now. Please try again later or contact ${inv.business.name}.`,
    };
  }
  redirect(r.url);
}

export async function claimTransfer(_: FormState, form: FormData): Promise<FormState> {
  const inv = await invoiceByToken(str(form, "token"));
  if (!inv) return { message: "This invoice link is no longer valid." };
  const payerName = str(form, "payerName");
  const amount = parseAmount(str(form, "amount"));
  const values = { payerName, amount: str(form, "amount"), note: str(form, "note") };
  const errors: Record<string, string> = {};
  if (payerName.length < 2) errors.payerName = "Enter the name on the account you paid from, so they can find it.";
  if (!(amount > 0)) errors.amount = "Enter how much you sent.";
  if (Object.keys(errors).length) return { errors, values };
  const pending = await db.paymentClaim.count({ where: { invoiceId: inv.id, status: "PENDING" } });
  if (pending >= 3) return { ok: true, message: `${inv.business.name} already has your message and will confirm soon.` };

  await db.paymentClaim.create({ data: { invoiceId: inv.id, payerName, amount, note: str(form, "note") || null } });
  await db.invoiceEvent.create({ data: { invoiceId: inv.id, type: "CLAIM", note: `${payerName}: ${money(amount, inv.currency)}` } });

  const to = inv.business.email;
  if (to) {
    const { html, text } = layout({
      heading: `${inv.customer.name} says they've paid ${money(amount, inv.currency)}`,
      paragraphs: [
        `They sent a transfer for invoice ${esc(inv.number)} from an account named <strong>${esc(payerName)}</strong>.`,
        "Check your bank app. When you see it, confirm it in BizBooks and the invoice updates.",
      ],
      button: { label: "Confirm payment", href: new URL(`/app/invoices/${inv.id}`, siteUrl()).toString() },
    });
    await sendEmail({ to, subject: `Check your bank: ${money(amount, inv.currency)} from ${inv.customer.name}`, html, text });
  }
  return { ok: true, message: `Thank you. We've told ${inv.business.name}. They'll confirm once it shows in their account.` };
}

/**
 * Client accepts a quote online. With a deposit set, we raise the deposit invoice straight away and
 * send them to pay it: "lock in the project" in one step.
 */
export async function acceptQuote(_: FormState, form: FormData): Promise<FormState> {
  const quote = await invoiceByToken(str(form, "token"));
  if (!quote || quote.kind !== "QUOTE") return { message: "This quote link is no longer valid." };
  if (!["SENT", "DRAFT"].includes(quote.status)) return { message: "This quote has already been accepted or closed." };
  const name = str(form, "acceptedBy");
  if (name.length < 2) return { errors: { acceptedBy: "Enter your name so they know who approved it." }, values: { acceptedBy: name } };

  // Only one acceptance wins: a double tap (or two people at the client) mustn't raise two deposit invoices.
  const accepted = await db.invoice.updateMany({
    where: { id: quote.id, status: { in: ["SENT", "DRAFT"] } },
    data: { status: "ACCEPTED", acceptedAt: new Date(), acceptedBy: name },
  });
  if (accepted.count !== 1) return { message: "This quote has already been accepted or closed." };
  await db.invoiceEvent.create({ data: { invoiceId: quote.id, type: "ACCEPTED", note: `Accepted online by ${name}` } });

  let depositToken: string | null = null;
  if (quote.depositPercent) {
    const totals = computeTotals(quote.items, quote.discount, 0, 0);
    const amount = round2((totals.taxable * quote.depositPercent) / 100);
    const dep = await createInvoice({
      businessId: quote.businessId, customerId: quote.customerId, kind: "INVOICE", issueDate: new Date(), dueDate: addDays(new Date(), 3),
      lines: [{ description: `Deposit (${quote.depositPercent}%) for quote ${quote.number}`, quantity: 1, unitPrice: amount }],
      discount: 0, vatRate: quote.vatRate, whtRate: quote.whtRate, notes: null, depositForId: quote.id, poNumber: quote.poNumber,
      // Same currency and rate as the quote: a $10,000 quote's 50% deposit is $5,000, not ₦5,000.
      currency: quote.currency, exchangeRate: quote.exchangeRate,
    });
    await markSent(dep.id, "Raised when the client accepted the quote online");
    depositToken = dep.publicToken;
  }

  if (quote.business.email) {
    const { html, text } = layout({
      heading: `${quote.customer.name} accepted quote ${quote.number}`,
      paragraphs: [
        `${esc(name)} approved your quote for <strong>${money(quote.total, quote.currency)}</strong>.`,
        quote.depositPercent ? `We've sent them a ${quote.depositPercent}% deposit invoice to pay now. You'll be told when it's paid.` : "Turn it into an invoice when you're ready to bill.",
      ],
      button: { label: "Open the quote", href: new URL(`/app/invoices/${quote.id}`, siteUrl()).toString() },
    });
    await sendEmail({ to: quote.business.email, subject: `Quote ${quote.number} accepted by ${quote.customer.name}`, html, text });
  }
  if (depositToken) redirect(`${publicInvoiceUrl(depositToken)}#pay`);
  return { ok: true, message: `Thank you. ${quote.business.name} has been told you've accepted.` };
}
