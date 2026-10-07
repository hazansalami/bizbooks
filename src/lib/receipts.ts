import "server-only";
import { db } from "./db";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { money, round2 } from "./money";
import { siteUrl } from "./site-url";
import { formatDate, greetingName, randomToken } from "./utils";

/*
  A receipt for every payment: numbered per business (RCT-0001...), with a private link the client can
  open, save as PDF or forward to their finance team. Numbers are given out when a payment is recorded;
  payments from before receipts existed get theirs the first time anyone asks.
*/

export const receiptUrl = (token: string) => new URL(`/receipt/${token}`, siteUrl()).toString();

/** Gives the payment a receipt number and link if it doesn't have one yet. Safe to call repeatedly. */
export async function ensureReceipt(paymentId: string) {
  const p = await db.payment.findUnique({ where: { id: paymentId }, select: { id: true, businessId: true, receiptNumber: true, receiptToken: true } });
  if (!p) return null;
  if (p.receiptNumber && p.receiptToken) return { number: p.receiptNumber, token: p.receiptToken };
  return db.$transaction(async (tx) => {
    // Incrementing the counter locks the business row, so two payments can't take the same number.
    const b = await tx.business.update({ where: { id: p.businessId }, data: { receiptCounter: { increment: 1 } }, select: { receiptCounter: true } });
    const number = `RCT-${String(b.receiptCounter).padStart(4, "0")}`;
    const token = randomToken(18);
    const done = await tx.payment.updateMany({ where: { id: p.id, receiptNumber: null }, data: { receiptNumber: number, receiptToken: token } });
    if (!done.count) {
      // Someone else numbered it a moment ago: use theirs (this number is simply skipped).
      const now = await tx.payment.findUniqueOrThrow({ where: { id: p.id }, select: { receiptNumber: true, receiptToken: true } });
      return { number: now.receiptNumber!, token: now.receiptToken! };
    }
    return { number, token };
  });
}

/** Numbers every payment on an invoice that doesn't have a receipt yet, oldest first. */
export async function ensureReceipts(invoiceId: string) {
  const missing = await db.payment.findMany({ where: { invoiceId, receiptNumber: null }, orderBy: { paidAt: "asc" }, select: { id: true } });
  for (const m of missing) await ensureReceipt(m.id);
}

/** Everything the receipt shows: the payment, who paid, what for, and the invoice position after it. */
export async function loadReceipt(token: string) {
  const p = await db.payment.findUnique({
    where: { receiptToken: token },
    include: { business: true, invoice: { include: { customer: true, payments: { select: { id: true, amount: true, paidAt: true, createdAt: true } } } } },
  });
  if (!p) return null;
  const inv = p.invoice;
  // Paid before this one: payments dated earlier (or same moment but recorded earlier).
  const before = inv ? inv.payments.filter((x) => x.id !== p.id && (x.paidAt < p.paidAt || (x.paidAt.getTime() === p.paidAt.getTime() && x.createdAt < p.createdAt))).reduce((s, x) => s + x.amount, 0) : 0;
  const due = inv ? round2(inv.total - inv.whtAmount) : p.amount;
  const balanceAfter = inv ? Math.max(0, round2(due - before - p.amount)) : 0;
  return { p, inv, b: p.business, paidBefore: round2(before), balanceAfter, due };
}

export type Receipt = NonNullable<Awaited<ReturnType<typeof loadReceipt>>>;

/** Emails the receipt link to the client. Returns why not when it can't. */
export async function emailReceipt(paymentId: string) {
  const r = await ensureReceipt(paymentId);
  if (!r) return { ok: false as const, error: "Payment not found." };
  const data = await loadReceipt(r.token);
  if (!data?.inv) return { ok: false as const, error: "This payment isn't linked to an invoice." };
  const { p, inv, b, balanceAfter } = data;
  if (!inv.customer.email) return { ok: false as const, error: `${inv.customer.name} has no email address. Share the receipt link on WhatsApp instead.` };
  const amount = money(p.amount, inv.currency);
  const { html, text } = layout({
    heading: `Receipt ${r.number}: ${amount} received`,
    preview: `${b.name} received your payment for ${inv.number}.`,
    color: b.brandColor,
    paragraphs: [
      `Hello ${esc(greetingName(inv.customer.name))},`,
      `Thank you. ${esc(b.name)} received <strong>${esc(amount)}</strong> on ${formatDate(p.paidAt)} for invoice ${esc(inv.number)}.`,
      balanceAfter > 0.005 ? `The balance still due on ${esc(inv.number)} is <strong>${esc(money(balanceAfter, inv.currency))}</strong>.` : `Invoice ${esc(inv.number)} is now paid in full.`,
    ],
    button: { label: "View or download receipt", href: receiptUrl(r.token) },
    footer: esc(b.name),
  });
  const sent = await sendEmail({ to: inv.customer.email, subject: `Receipt ${r.number} from ${b.name}: ${amount}`, html, text, replyTo: b.email, fromName: b.name });
  if (!sent.ok) return { ok: false as const, error: "We couldn't send the email just now. Try again in a minute." };
  await db.$transaction([
    db.payment.update({ where: { id: p.id }, data: { receiptSentAt: new Date() } }),
    db.invoiceEvent.create({ data: { invoiceId: inv.id, type: "RECEIPT", note: `Receipt ${r.number} emailed to ${inv.customer.email}` } }),
  ]);
  return { ok: true as const, number: r.number, to: inv.customer.email };
}

/** The short WhatsApp message with the receipt link. */
export function receiptWhatsappText(d: { number: string; token: string; amount: string; invoiceNumber: string; business: string; customer: string }) {
  return `Hello ${greetingName(d.customer)}, thank you for your payment of ${d.amount} for invoice ${d.invoiceNumber}. Here is your receipt ${d.number}: ${receiptUrl(d.token)}\n\n${d.business}`;
}
