import "server-only";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { balanceDue, computeTotals, naira, round2, type LineInput } from "./money";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";
import { addDays, formatDate, greetingName, randomToken } from "./utils";
import { isPro } from "./plan";
import { APP_NAME } from "./constants";

type Tx = Prisma.TransactionClient;

export function publicInvoiceUrl(token: string) {
  return new URL(`/i/${token}`, siteUrl()).toString();
}

/** One tap from an email or WhatsApp message straight into the gateway checkout. */
export function payUrl(token: string) {
  return new URL(`/pay/${token}`, siteUrl()).toString();
}

async function nextNumber(tx: Tx, businessId: string, kind: "INVOICE" | "QUOTE") {
  const b = await tx.business.update({
    where: { id: businessId },
    data: kind === "INVOICE" ? { nextInvoiceNo: { increment: 1 } } : { nextQuoteNo: { increment: 1 } },
    select: { invoicePrefix: true, quotePrefix: true, nextInvoiceNo: true, nextQuoteNo: true },
  });
  const n = kind === "INVOICE" ? b.nextInvoiceNo - 1 : b.nextQuoteNo - 1;
  const prefix = kind === "INVOICE" ? b.invoicePrefix : b.quotePrefix;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

export type NewInvoice = {
  businessId: string; customerId: string; kind: "INVOICE" | "QUOTE"; issueDate: Date; dueDate: Date;
  lines: LineInput[]; discount: number; vatRate: number; whtRate: number; notes: string | null;
  recurringId?: string | null; convertedFromId?: string | null;
  poNumber?: string | null; depositPercent?: number | null; depositForId?: string | null;
};

export async function createInvoice(input: NewInvoice, tx?: Tx) {
  const run = async (t: Tx) => {
    const totals = computeTotals(input.lines, input.discount, input.vatRate, input.whtRate);
    const number = await nextNumber(t, input.businessId, input.kind);
    const inv = await t.invoice.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        kind: input.kind,
        number,
        issueDate: input.issueDate,
        dueDate: input.dueDate,
        subtotal: totals.subtotal,
        discount: totals.discount,
        vatRate: input.vatRate,
        vatAmount: totals.vatAmount,
        whtRate: input.whtRate,
        whtAmount: totals.whtAmount,
        total: totals.total,
        notes: input.notes,
        publicToken: randomToken(),
        recurringId: input.recurringId ?? null,
        convertedFromId: input.convertedFromId ?? null,
        poNumber: input.poNumber ?? null,
        depositPercent: input.kind === "QUOTE" ? input.depositPercent ?? null : null,
        depositForId: input.depositForId ?? null,
        items: {
          create: input.lines.map((l, i) => ({
            description: l.description, quantity: l.quantity, unitPrice: round2(l.unitPrice),
            amount: round2(l.quantity * l.unitPrice), position: i,
          })),
        },
        events: { create: { type: "CREATED" } },
      },
    });
    return inv;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/**
 * Record money against an invoice. Safe to call twice with the same gateway reference
 * (redirect and webhook often both arrive): the unique reference makes the second call a no-op.
 */
export async function applyPayment(invoiceId: string, p: { amount: number; method: string; reference?: string | null; paidAt?: Date; note?: string | null }) {
  const amount = round2(p.amount);
  if (!(amount > 0)) return { ok: false as const, error: "Enter an amount above zero." };
  try {
    return await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return { ok: false as const, error: "Invoice not found." };
      if (inv.status === "VOID") return { ok: false as const, error: "This invoice was cancelled." };
      await tx.payment.create({
        data: {
          businessId: inv.businessId, invoiceId, amount, method: p.method, reference: p.reference ?? null,
          paidAt: p.paidAt ?? new Date(), note: p.note ?? null,
        },
      });
      const amountPaid = round2(inv.amountPaid + amount);
      const fullyPaid = balanceDue({ ...inv, amountPaid }) <= 0.005;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid,
          status: fullyPaid ? "PAID" : "PARTIAL",
          paidAt: fullyPaid ? p.paidAt ?? new Date() : null,
          sentAt: inv.sentAt ?? new Date(),
          events: { create: { type: "PAYMENT", note: `${naira(amount)} by ${p.method.replace("_", " ").toLowerCase()}` } },
        },
      });
      return { ok: true as const, fullyPaid };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true as const, duplicate: true, fullyPaid: undefined };
    throw e;
  }
}

/** Recompute status after a payment is deleted. */
export async function refreshInvoicePaid(invoiceId: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return;
  const amountPaid = round2(inv.payments.reduce((s, p) => s + p.amount, 0));
  const due = balanceDue({ ...inv, amountPaid });
  const status = inv.status === "VOID" ? "VOID" : amountPaid <= 0 ? (inv.sentAt ? "SENT" : "DRAFT") : due <= 0.005 ? "PAID" : "PARTIAL";
  await db.invoice.update({ where: { id: invoiceId }, data: { amountPaid, status, paidAt: status === "PAID" ? inv.paidAt ?? new Date() : null } });
}

const fullInclude = { business: { include: { bankAccounts: true, gateways: true } }, customer: true, items: { orderBy: { position: "asc" as const } } };
export type FullInvoice = Prisma.InvoiceGetPayload<{ include: typeof fullInclude }>;

export async function loadFullInvoice(id: string) {
  return db.invoice.findUnique({ where: { id }, include: fullInclude });
}

export function canPayOnline(inv: FullInvoice) {
  return inv.kind === "INVOICE" && inv.business.gateways.some((g) => g.enabled);
}

function bankLines(inv: FullInvoice) {
  return inv.business.bankAccounts
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
    .map((a) => `${a.bankName}: <strong>${esc(a.accountNumber)}</strong> (${esc(a.accountName)})`);
}

/** The short message owners paste into WhatsApp. Plain text; WhatsApp previews the link. */
export function whatsappMessage(inv: FullInvoice, kind: "send" | "reminder" = "send") {
  const due = balanceDue(inv);
  const first = greetingName(inv.customer.name);
  if (inv.kind === "QUOTE") {
    return `Hello ${first}, here is our quote ${inv.number} for ${naira(inv.total)} from ${inv.business.name}:\n${publicInvoiceUrl(inv.publicToken)}`;
  }
  const lines = [
    kind === "send"
      ? `Hello ${first}, here is invoice ${inv.number} from ${inv.business.name} for ${naira(due)}, due ${formatDate(inv.dueDate)}.`
      : `Hello ${first}, a friendly reminder that invoice ${inv.number} for ${naira(due)} ${inv.dueDate < new Date() ? "is now overdue" : `is due ${formatDate(inv.dueDate)}`}.`,
  ];
  if (canPayOnline(inv)) lines.push(`Pay by card, transfer or USSD in one tap: ${payUrl(inv.publicToken)}`);
  else lines.push(`View and pay: ${publicInvoiceUrl(inv.publicToken)}`);
  const bank = inv.business.bankAccounts.find((a) => a.isDefault) ?? inv.business.bankAccounts[0];
  if (bank) lines.push(`Or transfer to ${bank.bankName} ${bank.accountNumber} (${bank.accountName}).`);
  lines.push("Thank you.");
  return lines.join("\n");
}

export async function emailInvoice(inv: FullInvoice, kind: "send" | "reminder" = "send") {
  if (!inv.customer.email) return { ok: false, error: `${inv.customer.name} has no email address. Add one, or share on WhatsApp instead.` };
  const due = balanceDue(inv);
  const online = canPayOnline(inv);
  const isQuote = inv.kind === "QUOTE";
  const overdue = inv.dueDate < new Date();
  const heading = isQuote
    ? `Quote ${inv.number} from ${inv.business.name}`
    : kind === "reminder"
      ? overdue ? `Invoice ${inv.number} is overdue` : `Reminder: invoice ${inv.number} is due ${formatDate(inv.dueDate)}`
      : `Invoice ${inv.number} from ${inv.business.name}`;
  const paragraphs = [
    `Hello ${esc(greetingName(inv.customer.name))},`,
    isQuote
      ? `${esc(inv.business.name)} has sent you a quote for <strong>${naira(inv.total)}</strong>.`
      : `${kind === "reminder" ? "Just a reminder: " : ""}${esc(inv.business.name)} has sent you an invoice for <strong>${naira(due)}</strong>, due on <strong>${formatDate(inv.dueDate)}</strong>.`,
  ];
  const banks = bankLines(inv);
  const after = !isQuote && banks.length
    ? [`${online ? "Prefer a bank transfer? " : "Pay by bank transfer to:"}<br>${banks.join("<br>")}<br>Use <strong>${inv.number}</strong> as the narration.`]
    : [];
  after.push(`<a href="${publicInvoiceUrl(inv.publicToken)}">View the full ${isQuote ? "quote" : "invoice"}</a>`);
  const { html, text } = layout({
    heading,
    paragraphs,
    button: isQuote ? { label: "View quote", href: publicInvoiceUrl(inv.publicToken) }
      : online ? { label: `Pay ${naira(due)} now`, href: payUrl(inv.publicToken) }
      : { label: "View invoice", href: publicInvoiceUrl(inv.publicToken) },
    after,
    color: isPro(inv.business) ? inv.business.brandColor : undefined,
    footer: isPro(inv.business) ? inv.business.name : `Sent by ${esc(inv.business.name)} with ${APP_NAME}`,
  });
  const r = await sendEmail({ to: inv.customer.email, subject: heading, html, text, replyTo: inv.business.email, fromName: inv.business.name });
  if (!r.ok) return r;
  const now = new Date();
  await db.invoice.update({
    where: { id: inv.id },
    data: kind === "reminder"
      ? { lastReminderAt: now, reminderCount: { increment: 1 }, events: { create: { type: "REMINDER", note: `Emailed ${inv.customer.email}` } } }
      : {
          sentAt: inv.sentAt ?? now,
          status: inv.status === "DRAFT" ? "SENT" : inv.status,
          events: { create: { type: "SENT", note: `Emailed ${inv.customer.email}` } },
        },
  });
  return { ok: true };
}

export async function markSent(invoiceId: string, note: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return;
  await db.invoice.update({
    where: { id: invoiceId },
    data: { sentAt: inv.sentAt ?? new Date(), status: inv.status === "DRAFT" ? "SENT" : inv.status, events: { create: { type: "SENT", note } } },
  });
}

export function defaultDueDate(issue: Date, termsDays: number) {
  return addDays(issue, termsDays);
}
