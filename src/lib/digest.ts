import "server-only";
import { db } from "./db";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { balanceDue, naira, round2 } from "./money";
import { cashForecast } from "./forecast";
import { obligationStatus, taxObligations } from "./taxes";
import { siteUrl } from "./site-url";
import { addDays, daysBetween, formatDate, startOfDay } from "./utils";

/*
  The Monday money email: one look at last week and the week ahead, so owners act without opening the app.
  Last week's money in and out, who to chase, what's due this week (client payments, bills, taxes,
  promises), and the cash low point from the forecast. Skipped when there's nothing worth saying.
*/

const ACTIVE_DAYS = 45;
const short = (d: Date) => formatDate(d, { day: "numeric", month: "short" });
const app = (path: string) => new URL(path, siteUrl()).toString();

type Row = { text: string; amount?: string; href?: string; tone?: "danger" | "muted" };

function section(title: string, rows: Row[]) {
  if (!rows.length) return "";
  const tr = rows.map((r) => {
    const label = r.href ? `<a href="${r.href}" style="color:#14201b;text-decoration:none">${r.text}</a>` : r.text;
    const color = r.tone === "danger" ? "#b42318" : r.tone === "muted" ? "#5e6a64" : "#14201b";
    return `<tr><td style="padding:7px 0;border-bottom:1px solid #eee9de;font-size:14px;color:${color}">${label}</td><td style="padding:7px 0 7px 12px;border-bottom:1px solid #eee9de;font-size:14px;text-align:right;white-space:nowrap;font-weight:600;color:${color}">${r.amount ?? ""}</td></tr>`;
  }).join("");
  return `<p style="margin:22px 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5e6a64;font-weight:700">${title}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${tr}</table>`;
}

function stat(label: string, value: string, color = "#14201b") {
  return `<td style="padding:12px;border:1px solid #eee9de;border-radius:10px;width:33%"><div style="font-size:12px;color:#5e6a64">${label}</div><div style="font-size:18px;font-weight:700;color:${color}">${value}</div></td>`;
}

/** Builds (but doesn't send) one business's digest. Null when there's nothing worth an email. */
export async function buildDigest(businessId: string, now = new Date()) {
  const b = await db.business.findUniqueOrThrow({ where: { id: businessId }, include: { owner: { select: { email: true, fullName: true } } } });
  const today = startOfDay(now);
  const weekAgo = addDays(today, -7);
  const weekAhead = addDays(today, 7);

  const [payments, spent, open, bills, promises, obligations] = await Promise.all([
    db.payment.findMany({ where: { businessId, paidAt: { gte: weekAgo, lt: today } }, select: { amount: true, exchangeRate: true } }),
    db.expense.findMany({ where: { businessId, paid: true, OR: [{ paidAt: { gte: weekAgo, lt: today } }, { paidAt: null, date: { gte: weekAgo, lt: today } }] }, select: { amount: true } }),
    db.invoice.findMany({ where: { businessId, kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } }, include: { customer: { select: { name: true } } } }),
    db.expense.findMany({ where: { businessId, paid: false, dueDate: { lt: weekAhead } }, orderBy: { dueDate: "asc" }, take: 5 }),
    db.paymentPromise.findMany({ where: { businessId, status: "OPEN", promisedFor: { gte: today, lt: weekAhead } }, include: { invoice: { include: { customer: { select: { name: true } } } } }, orderBy: { promisedFor: "asc" } }),
    taxObligations(b, 3),
  ]);

  const moneyIn = round2(payments.reduce((s, p) => s + p.amount * p.exchangeRate, 0));
  const moneyOut = round2(spent.reduce((s, e) => s + e.amount, 0));
  const ngn = (i: (typeof open)[number]) => balanceDue(i) * i.exchangeRate;
  const owed = round2(open.reduce((s, i) => s + ngn(i), 0));
  const overdue = open.filter((i) => i.dueDate < today).sort((x, y) => ngn(y) - ngn(x));
  const overdueTotal = round2(overdue.reduce((s, i) => s + ngn(i), 0));
  const dueSoon = open.filter((i) => i.dueDate >= today && i.dueDate < weekAhead).sort((x, y) => x.dueDate.getTime() - y.dueDate.getTime());
  const taxes = obligations.filter((o) => !o.filed && o.dueDate < weekAhead);

  let low: { amount: number; week: Date; short: boolean } | null = null;
  if (b.cashBalance != null) {
    const f = await cashForecast(b, { everyday: true }).catch(() => null);
    if (f) low = f.firstShort ? { amount: f.firstShort.closing, week: f.firstShort.start, short: true } : { amount: f.lowest.closing, week: f.lowest.start, short: false };
  }

  const nothing = !moneyIn && !moneyOut && !owed && !bills.length && !taxes.length && !promises.length;
  if (nothing) return null;

  const chase: Row[] = overdue.slice(0, 5).map((i) => ({
    text: `${esc(i.customer.name)} · ${esc(i.number)} · ${daysBetween(startOfDay(i.dueDate), today)} days late`,
    amount: naira(ngn(i)), href: app(`/app/invoices/${i.id}`), tone: "danger",
  }));
  if (overdue.length > 5) chase.push({ text: `and ${overdue.length - 5} more`, href: app("/app/invoices?filter=overdue"), tone: "muted" });

  const ahead: Row[] = [
    ...dueSoon.slice(0, 4).map((i) => ({ text: `${esc(i.customer.name)} should pay ${esc(i.number)} by ${short(i.dueDate)}`, amount: `+${naira(ngn(i))}`, href: app(`/app/invoices/${i.id}`) })),
    ...promises.map((p) => ({ text: `${esc(p.invoice.customer.name)} promised to pay ${esc(p.invoice.number)} by ${short(p.promisedFor)}`, amount: `+${naira(p.amount * p.invoice.exchangeRate)}`, href: app(`/app/invoices/${p.invoiceId}`) })),
    ...bills.map((e) => ({ text: `Bill: ${esc(e.vendor ?? e.category)}${e.dueDate && e.dueDate < today ? " (overdue)" : e.dueDate ? `, due ${short(e.dueDate)}` : ""}`, amount: `−${naira(e.amount)}`, href: app(`/app/expenses/${e.id}`), tone: e.dueDate && e.dueDate < today ? ("danger" as const) : undefined })),
    ...taxes.map((o) => ({ text: `${esc(o.title)}${obligationStatus(o, now) === "overdue" ? " (late)" : `, due ${short(o.dueDate)}`}`, amount: `−${naira(o.amount)}`, href: app(o.kind === "VAT" ? `/app/taxes/vat?month=${o.period}` : "/app/taxes"), tone: obligationStatus(o, now) === "overdue" ? ("danger" as const) : undefined })),
  ];

  const stats = `<table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="margin:6px -6px 0"><tr>${stat("In last week", naira(moneyIn), "#0a5a3f")}${stat("Out last week", naira(moneyOut))}${stat("Owed to you", naira(owed), overdueTotal > 0 ? "#b42318" : "#14201b")}</tr></table>`;
  const forecast = low
    ? low.short
      ? `<p style="margin:22px 0 0;padding:12px 14px;border-radius:10px;background:#fdecea;color:#b42318;font-size:14px"><strong>Cash runs short in the week of ${short(low.week)}</strong> (about ${naira(low.amount)}). <a href="${app("/app/forecast")}" style="color:#b42318">See the forecast</a></p>`
      : `<p style="margin:22px 0 0;font-size:14px;color:#37443e">Cash forecast: lowest point about <strong>${naira(low.amount)}</strong> in the week of ${short(low.week)}. No shortfall in the next 13 weeks.</p>`
    : `<p style="margin:22px 0 0;font-size:13px;color:#5e6a64">Add today's bank balance on the <a href="${app("/app/forecast")}" style="color:#0a5a3f">cash forecast</a> to see where cash is heading.</p>`;

  const first = b.owner.fullName.split(" ")[0];
  const headline = overdue.length
    ? `${naira(overdueTotal)} overdue from ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`
    : owed > 0 ? `${naira(owed)} owed to you, nothing overdue` : "Nothing owed to you right now";
  const { html } = layout({
    heading: `Your money this week`,
    preview: headline,
    color: b.brandColor,
    paragraphs: [
      `Good morning ${esc(first)}, here's ${esc(b.name)} at a glance.`,
      stats + section("Chase this week", chase) + section("Due this week, and anything late", ahead) + forecast,
    ],
    button: { label: "Open BizBooks", href: app("/app") },
    after: [`You get this every Monday. Turn it off under Settings → Invoices and tax.`],
  });
  // Plain-text version written out, since the HTML is mostly tables.
  const unescape = (t: string) => t.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  const plain = (title: string, rows: Row[]) => (rows.length ? ["", title, ...rows.map((r) => `- ${unescape(r.text)}${r.amount ? `: ${r.amount}` : ""}`)] : []);
  const text = [
    `Your money this week: ${b.name}`,
    `In last week: ${naira(moneyIn)} | Out last week: ${naira(moneyOut)} | Owed to you: ${naira(owed)}`,
    ...plain("Chase this week", chase),
    ...plain("Due this week, and anything late", ahead),
    ...(low ? ["", low.short ? `Cash runs short in the week of ${short(low.week)} (about ${naira(low.amount)}).` : `Cash forecast low point: about ${naira(low.amount)} in the week of ${short(low.week)}.`] : []),
    "",
    `Open BizBooks: ${app("/app")}`,
    "You get this every Monday. Turn it off under Settings.",
  ].join("\n");
  return { to: b.email || b.owner.email, subject: `${b.name}: ${headline}`, html, text };
}

/** Daily cron: on Mondays, send each active business its digest once. */
export async function runWeeklyDigest(now = new Date()) {
  const out = { sent: 0, skipped: 0 };
  if (now.getDay() !== 1) return out;
  const businesses = await db.business.findMany({
    where: {
      weeklyDigest: true, onboardedAt: { not: null }, lastActiveAt: { gte: addDays(now, -ACTIVE_DAYS) },
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: addDays(now, -6) } }],
    },
    select: { id: true }, take: 500,
  });
  for (const { id } of businesses) {
    try {
      const d = await buildDigest(id, now);
      // Mark it either way, so a quiet business isn't rebuilt every day this week.
      await db.business.update({ where: { id }, data: { lastDigestAt: now } });
      if (!d) { out.skipped++; continue; }
      const r = await sendEmail({ to: d.to, subject: d.subject, html: d.html, text: d.text });
      if (r.ok) out.sent++;
    } catch (e) {
      console.error("digest", id, e);
    }
  }
  return out;
}
