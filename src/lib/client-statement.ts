import "server-only";
import { db } from "./db";
import { balanceDue, money, round2 } from "./money";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";
import { addDays, daysBetween, formatDate, greetingName, randomToken, startOfDay } from "./utils";

/*
  Statement of account for one client: what was invoiced, what they paid (and any WHT they deducted), the
  running balance, and how old the unpaid part is. The document a client's finance team asks for before a
  payment run, and the quickest way to settle "what do we owe you?".
  One currency per statement: a client billed in naira and dollars gets one for each.
*/

export const STATEMENT_PERIODS = {
  all: "All time",
  "this-year": "This year",
  "last-year": "Last year",
  "90": "Last 90 days",
} as const;
export type StatementPeriod = keyof typeof STATEMENT_PERIODS;
export const isStatementPeriod = (p: string | undefined): p is StatementPeriod => !!p && p in STATEMENT_PERIODS;

function range(period: StatementPeriod, now = new Date()): { from: Date | null; to: Date } {
  const end = addDays(startOfDay(now), 1);
  if (period === "this-year") return { from: new Date(now.getFullYear(), 0, 1), to: end };
  if (period === "last-year") return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear(), 0, 1) };
  if (period === "90") return { from: addDays(startOfDay(now), -89), to: end };
  return { from: null, to: end };
}

export type StatementLine = { date: Date; kind: "INVOICE" | "PAYMENT" | "WHT"; ref: string; detail: string; charge: number; credit: number; balance: number; href?: string; dueDate?: Date };

export async function clientStatement(businessId: string, customerId: string, opts: { period?: StatementPeriod; currency?: string } = {}) {
  const period = opts.period ?? "all";
  const customer = await db.customer.findFirst({ where: { id: customerId, businessId } });
  if (!customer) return null;
  const invoices = await db.invoice.findMany({
    where: { businessId, customerId, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] } },
    include: { payments: { select: { id: true, amount: true, paidAt: true, method: true, reference: true, receiptNumber: true, receiptToken: true } } },
    orderBy: { issueDate: "asc" },
  });
  // Which currencies this client is billed in; naira first, then the most used.
  const counts = new Map<string, number>();
  for (const i of invoices) counts.set(i.currency, (counts.get(i.currency) ?? 0) + 1);
  const currencies = [...counts.keys()].sort((a, b) => (a === "NGN" ? -1 : b === "NGN" ? 1 : (counts.get(b) ?? 0) - (counts.get(a) ?? 0)));
  const currency = opts.currency && counts.has(opts.currency) ? opts.currency : currencies[0] ?? "NGN";
  const mine = invoices.filter((i) => i.currency === currency);

  // Every movement on the account, in date order (on the same day: invoice, then WHT, then payments).
  type Move = Omit<StatementLine, "balance">;
  const moves: Move[] = [];
  for (const i of mine) {
    moves.push({ date: i.issueDate, kind: "INVOICE", ref: i.number, detail: i.title?.trim() || `Due ${formatDate(i.dueDate)}`, charge: i.total, credit: 0, href: `/i/${i.publicToken}`, dueDate: i.dueDate });
    if (i.whtAmount > 0) moves.push({ date: i.issueDate, kind: "WHT", ref: i.number, detail: "Withholding tax deducted at source", charge: 0, credit: i.whtAmount });
    for (const p of i.payments) {
      moves.push({ date: p.paidAt, kind: "PAYMENT", ref: p.receiptNumber ?? i.number, detail: `Payment for ${i.number}${p.reference ? ` · ref ${p.reference}` : ""}`, charge: 0, credit: p.amount, href: p.receiptToken ? `/receipt/${p.receiptToken}` : undefined });
    }
  }
  const order = { INVOICE: 0, WHT: 1, PAYMENT: 2 };
  moves.sort((a, b) => a.date.getTime() - b.date.getTime() || order[a.kind] - order[b.kind]);

  const { from, to } = range(period);
  let opening = 0;
  const lines: StatementLine[] = [];
  let running = 0;
  for (const m of moves) {
    if (m.date >= to) continue;
    if (from && m.date < from) { opening = round2(opening + m.charge - m.credit); running = opening; continue; }
    running = round2(running + m.charge - m.credit);
    lines.push({ ...m, balance: running });
  }
  const invoiced = round2(lines.reduce((s, l) => s + l.charge, 0));
  const received = round2(lines.filter((l) => l.kind === "PAYMENT").reduce((s, l) => s + l.credit, 0));
  const wht = round2(lines.filter((l) => l.kind === "WHT").reduce((s, l) => s + l.credit, 0));

  // How overdue the unpaid invoices are today (whatever the period shown).
  const today = startOfDay(new Date());
  const aging = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
  const open = mine.filter((i) => ["SENT", "PARTIAL"].includes(i.status) && balanceDue(i) > 0.005);
  for (const i of open) {
    const late = daysBetween(startOfDay(i.dueDate), today);
    const due = balanceDue(i);
    if (late <= 0) aging.current += due;
    else if (late <= 30) aging.d30 += due;
    else if (late <= 60) aging.d60 += due;
    else if (late <= 90) aging.d90 += due;
    else aging.older += due;
  }
  const outstanding = round2(open.reduce((s, i) => s + balanceDue(i), 0));

  return { customer, currency, currencies, period, from, to: addDays(to, -1), opening, closing: running, lines, invoiced, received, wht, aging, outstanding, openCount: open.length };
}

export type ClientStatement = NonNullable<Awaited<ReturnType<typeof clientStatement>>>;

/** The client's private statement link (made the first time it's needed). */
export async function statementToken(customerId: string) {
  const c = await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { statementToken: true } });
  if (c.statementToken) return c.statementToken;
  const token = randomToken(18);
  await db.customer.updateMany({ where: { id: customerId, statementToken: null }, data: { statementToken: token } });
  return (await db.customer.findUniqueOrThrow({ where: { id: customerId }, select: { statementToken: true } })).statementToken!;
}

export const statementUrl = (token: string, period?: StatementPeriod, currency?: string) => {
  const u = new URL(`/s/${token}`, siteUrl());
  if (period && period !== "all") u.searchParams.set("period", period);
  if (currency && currency !== "NGN") u.searchParams.set("currency", currency);
  return u.toString();
};

export async function emailStatement(businessId: string, customerId: string, period: StatementPeriod, currency?: string) {
  const [b, st] = await Promise.all([db.business.findUniqueOrThrow({ where: { id: businessId } }), clientStatement(businessId, customerId, { period, currency })]);
  if (!st) return { ok: false as const, error: "Client not found." };
  if (!st.customer.email) return { ok: false as const, error: `${st.customer.name} has no email address. Share the link on WhatsApp instead.` };
  const link = statementUrl(await statementToken(customerId), period, st.currency);
  const m = (n: number) => money(n, st.currency);
  const { html, text } = layout({
    heading: `Statement of account from ${b.name}`,
    color: b.brandColor,
    preview: st.outstanding > 0 ? `${m(st.outstanding)} outstanding` : "Your account is fully paid",
    paragraphs: [
      `Hello ${esc(greetingName(st.customer.name))},`,
      st.outstanding > 0.005
        ? `Here is your statement of account. The balance outstanding is <strong>${esc(m(st.outstanding))}</strong> across ${st.openCount} invoice${st.openCount === 1 ? "" : "s"}.`
        : "Here is your statement of account. Everything is paid, thank you.",
      "It lists every invoice and payment with a running balance, and you can download it as a PDF.",
    ],
    button: { label: "View statement", href: link },
    footer: esc(b.name),
  });
  const r = await sendEmail({ to: st.customer.email, subject: `Statement of account: ${b.name}`, html, text, replyTo: b.email, fromName: b.name });
  return r.ok ? { ok: true as const, to: st.customer.email } : { ok: false as const, error: "We couldn't send the email just now. Try again in a minute." };
}
