import "server-only";
import { grantTrialBonus } from "./growth";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { balanceDue, computeTotals, money, round2, type LineInput } from "./money";
import { GATEWAY_CURRENCIES } from "./currency";
import { paymentsEnabled } from "./platform-payments";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";
import { addDays, formatDate, greetingName, randomToken } from "./utils";
import { isPro, showsBranding } from "./plan";
import { APP_NAME } from "./constants";

type Tx = Prisma.TransactionClient;

export function publicInvoiceUrl(token: string) {
  return new URL(`/i/${token}`, siteUrl()).toString();
}

/** One tap from an email or WhatsApp message straight into the gateway checkout. */
export function payUrl(token: string) {
  return new URL(`/pay/${token}`, siteUrl()).toString();
}

/**
 * The next free number for this business. The counter usually is free, but imported invoices or a prefix
 * switched back can already hold it, so taken numbers are skipped (and the counter moves past them).
 */
async function nextNumber(tx: Tx, businessId: string, kind: "INVOICE" | "QUOTE") {
  for (let tries = 0; ; tries++) {
    const b = await tx.business.update({
      where: { id: businessId },
      data: kind === "INVOICE" ? { nextInvoiceNo: { increment: 1 } } : { nextQuoteNo: { increment: 1 } },
      select: { invoicePrefix: true, quotePrefix: true, nextInvoiceNo: true, nextQuoteNo: true },
    });
    const n = kind === "INVOICE" ? b.nextInvoiceNo - 1 : b.nextQuoteNo - 1;
    const prefix = kind === "INVOICE" ? b.invoicePrefix : b.quotePrefix;
    const number = `${prefix}-${String(n).padStart(4, "0")}`;
    const taken = await tx.invoice.findFirst({ where: { businessId, kind, number }, select: { id: true } });
    if (!taken) return number;
    if (tries > 200) throw new Error(`No free ${kind.toLowerCase()} number for business ${businessId}`);
    // A long run of taken numbers (e.g. 2,000 imported invoices): jump straight past the highest one.
    if (tries === 20) {
      const rows = await tx.invoice.findMany({ where: { businessId, kind, number: { startsWith: `${prefix}-` } }, select: { number: true } });
      const max = Math.max(n, ...rows.map((r) => Number(r.number.slice(prefix.length + 1))).filter(Number.isFinite));
      await tx.business.update({ where: { id: businessId }, data: kind === "INVOICE" ? { nextInvoiceNo: max + 1 } : { nextQuoteNo: max + 1 } });
    }
  }
}

export type NewInvoice = {
  businessId: string; customerId: string; kind: "INVOICE" | "QUOTE"; issueDate: Date; dueDate: Date;
  lines: LineInput[]; discount: number; vatRate: number; whtRate: number; notes: string | null;
  recurringId?: string | null; convertedFromId?: string | null;
  poNumber?: string | null; depositPercent?: number | null; depositForId?: string | null;
  title?: string | null; summary?: string | null;
  currency?: string; exchangeRate?: number;
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
        title: input.title ?? null,
        currency: input.currency ?? "NGN",
        exchangeRate: input.currency && input.currency !== "NGN" ? input.exchangeRate ?? 1 : 1,
        summary: input.summary ?? null,
        depositPercent: input.kind === "QUOTE" ? input.depositPercent ?? null : null,
        depositForId: input.depositForId ?? null,
        items: {
          create: input.lines.map((l, i) => ({
            description: l.description, details: l.details || null, quantity: l.quantity, unitPrice: round2(l.unitPrice),
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
/** amount is in the invoice's currency; exchangeRate (naira per unit) defaults to the invoice's own rate. */
export async function applyPayment(invoiceId: string, p: { amount: number; method: string; reference?: string | null; paidAt?: Date; note?: string | null; exchangeRate?: number; viaPlatform?: boolean; platformFee?: number; processorFee?: number }) {
  const amount = round2(p.amount);
  if (!(amount > 0)) return { ok: false as const, error: "Enter an amount above zero." };
  try {
    return await db.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!inv) return { ok: false as const, error: "Invoice not found." };
      if (inv.status === "VOID") return { ok: false as const, error: "This invoice was cancelled." };
      const payment = await tx.payment.create({
        data: {
          businessId: inv.businessId, invoiceId, amount, method: p.method, reference: p.reference ?? null,
          exchangeRate: inv.currency === "NGN" ? 1 : p.exchangeRate && p.exchangeRate > 0 ? p.exchangeRate : inv.exchangeRate,
          viaPlatform: p.viaPlatform ?? false, platformFee: round2(p.platformFee ?? 0), processorFee: round2(p.processorFee ?? 0),
          paidAt: p.paidAt ?? new Date(), note: p.note ?? null,
        },
      });
      // Increment in the database (which locks the row), then work out the status from what's there now,
      // so an edit or another payment committed a moment ago can't leave the status stale.
      const now = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          amountPaid: { increment: amount },
          sentAt: inv.sentAt ?? new Date(),
          events: { create: { type: "PAYMENT", note: `${money(amount, inv.currency)} by ${p.method.replace("_", " ").toLowerCase()}` } },
        },
      });
      const amountPaid = round2(now.amountPaid);
      const fullyPaid = balanceDue({ ...now, amountPaid }) <= 0.005;
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { amountPaid, status: fullyPaid ? "PAID" : "PARTIAL", paidAt: fullyPaid ? p.paidAt ?? new Date() : null },
      });
      return { ok: true as const, fullyPaid, paymentId: payment.id };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true as const, duplicate: true, fullyPaid: undefined, paymentId: undefined };
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

const fullInclude = { business: { include: { bankAccounts: true, gateways: true, paymentAccount: true } }, customer: true, items: { orderBy: { position: "asc" as const } } };
export type FullInvoice = Prisma.InvoiceGetPayload<{ include: typeof fullInclude }>;

export async function loadFullInvoice(id: string) {
  return db.invoice.findUnique({ where: { id }, include: fullInclude });
}

/** An enabled gateway that can charge in this invoice's currency. */
export function gatewayFor(inv: FullInvoice) {
  return inv.business.gateways.find((g) => g.enabled && (GATEWAY_CURRENCIES[g.provider] ?? ["NGN"]).includes(inv.currency));
}

/** BizBooks Payments is on for this business and can take this invoice (naira only). */
export function platformReady(inv: FullInvoice) {
  const a = inv.business.paymentAccount;
  return paymentsEnabled() && inv.currency === "NGN" && a?.status === "ACTIVE" && !!a.subaccountCode;
}

export function canPayOnline(inv: FullInvoice) {
  return inv.kind === "INVOICE" && (platformReady(inv) || !!gatewayFor(inv));
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
    return `Hello ${first}, here is our quote ${inv.number} for ${money(inv.total, inv.currency)} from ${inv.business.name}:\n${publicInvoiceUrl(inv.publicToken)}`;
  }
  const lines = [
    kind === "send"
      ? `Hello ${first}, here is invoice ${inv.number} from ${inv.business.name} for ${money(due, inv.currency)}, due ${formatDate(inv.dueDate)}.`
      : `Hello ${first}, a friendly reminder that invoice ${inv.number} for ${money(due, inv.currency)} ${inv.dueDate < new Date() ? "is now overdue" : `is due ${formatDate(inv.dueDate)}`}.`,
  ];
  if (canPayOnline(inv)) lines.push(`Pay by card, transfer or USSD in one tap: ${payUrl(inv.publicToken)}`);
  else lines.push(`View and pay: ${publicInvoiceUrl(inv.publicToken)}`);
  const bank = inv.business.bankAccounts.find((a) => a.isDefault) ?? inv.business.bankAccounts[0];
  if (bank) lines.push(`Or transfer to ${bank.bankName} ${bank.accountNumber} (${bank.accountName}).`);
  lines.push("Thank you.");
  return lines.join("\n");
}

function emailHeading(inv: FullInvoice, kind: "send" | "reminder") {
  if (inv.kind === "QUOTE") return `Quote ${inv.number} from ${inv.business.name}`;
  if (kind === "send") return `Invoice ${inv.number} from ${inv.business.name}`;
  return inv.dueDate < new Date() ? `Invoice ${inv.number} is overdue` : `Reminder: invoice ${inv.number} is due ${formatDate(inv.dueDate)}`;
}

/**
 * The editable part of an invoice email, as plain text: what the owner sees (and can change) in the
 * Email dialog. The pay button, bank details and invoice link are always added below it.
 */
export function emailDraft(inv: FullInvoice, kind: "send" | "reminder" = "send") {
  const due = balanceDue(inv);
  const lines = [
    `Hello ${greetingName(inv.customer.name)},`,
    inv.kind === "QUOTE"
      ? `${inv.business.name} has sent you a quote for ${money(inv.total, inv.currency)}.`
      : `${kind === "reminder" ? "Just a reminder: " : ""}${inv.business.name} has sent you an invoice for ${money(due, inv.currency)}, due on ${formatDate(inv.dueDate)}.`,
    `Thank you,\n${inv.business.name}`,
  ];
  return { subject: emailHeading(inv, kind), message: lines.join("\n\n") };
}

/** Plain text from the dialog → safe HTML paragraphs (blank line = new paragraph, newline = line break). */
function messageToParagraphs(message: string) {
  return message.replace(/\r\n/g, "\n").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).map((p) => esc(p).replace(/\n/g, "<br>"));
}

export type EmailOverride = { to?: string[]; cc?: string[]; subject?: string; message?: string };

export async function emailInvoice(inv: FullInvoice, kind: "send" | "reminder" = "send", o: EmailOverride = {}) {
  const to = o.to?.length ? o.to : inv.customer.email ? [inv.customer.email] : [];
  if (!to.length) return { ok: false, error: `${inv.customer.name} has no email address. Add one, or share on WhatsApp instead.` };
  const due = balanceDue(inv);
  const online = canPayOnline(inv);
  const isQuote = inv.kind === "QUOTE";
  const draft = emailDraft(inv, kind);
  const subject = o.subject?.trim() || draft.subject;
  const paragraphs = messageToParagraphs(o.message?.trim() || draft.message);
  const banks = bankLines(inv);
  const after = !isQuote && banks.length
    ? [`${online ? "Prefer a bank transfer? " : "Pay by bank transfer to:"}<br>${banks.join("<br>")}<br>Use <strong>${inv.number}</strong> as the narration.`]
    : [];
  after.push(`<a href="${publicInvoiceUrl(inv.publicToken)}">View the full ${isQuote ? "quote" : "invoice"}</a>`);
  const { html, text } = layout({
    heading: subject,
    paragraphs,
    button: isQuote ? { label: "View quote", href: publicInvoiceUrl(inv.publicToken) }
      : online ? { label: `Pay ${money(due, inv.currency)} now`, href: payUrl(inv.publicToken) }
      : { label: "View invoice", href: publicInvoiceUrl(inv.publicToken) },
    after,
    color: isPro(inv.business) ? inv.business.brandColor : undefined,
    footer: showsBranding(inv.business) ? `Sent by ${esc(inv.business.name)} with ${APP_NAME}` : inv.business.name,
  });
  const r = await sendEmail({ to, cc: o.cc, subject, html, text, replyTo: inv.business.email, fromName: inv.business.name });
  if (!r.ok) return r;
  const now = new Date();
  const note = `Emailed ${to.join(", ")}`;
  await db.invoice.update({
    where: { id: inv.id },
    data: kind === "reminder"
      ? { lastReminderAt: now, reminderCount: { increment: 1 }, events: { create: { type: "REMINDER", note } } }
      : {
          sentAt: inv.sentAt ?? now,
          status: inv.status === "DRAFT" ? "SENT" : inv.status,
          events: { create: { type: "SENT", note } },
        },
  });
  if (kind === "send" && inv.kind === "INVOICE") await grantTrialBonus(inv.businessId, "FIRST_INVOICE");
  return { ok: true, to, error: undefined as string | undefined };
}

export async function markSent(invoiceId: string, note: string) {
  const inv = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return;
  await db.invoice.update({
    where: { id: invoiceId },
    data: { sentAt: inv.sentAt ?? new Date(), status: inv.status === "DRAFT" ? "SENT" : inv.status, events: { create: { type: "SENT", note } } },
  });
  if (inv.kind === "INVOICE") await grantTrialBonus(inv.businessId, "FIRST_INVOICE");
}

export function defaultDueDate(issue: Date, termsDays: number) {
  return addDays(issue, termsDays);
}
