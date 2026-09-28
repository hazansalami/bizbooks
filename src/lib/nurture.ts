import "server-only";
import { db } from "./db";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";
import { TOOL_BY_SLUG, type ToolMeta } from "./tools";
import { addDays, formatDate } from "./utils";

/*
  Calculator lead nurture (emails skill: lead nurture pattern).

  Trigger: a visitor asks a public calculator to email their results (email 1 = that results email).
  Tracks by calculator group: PAYROLL, TAX, INVOICING. Emails 2–3 are track-specific, 4–6 shared.
  Timing: day 2, 5, 8, 12, 16 after sign-up, never on a weekend.
  Exits: the address signs up for BizBooks (checked before every send), unsubscribes, or finishes.
  One sequence per email address: later calculator uses don't restart it.
  Copy rules: value before ask, one job and one CTA per email, no invented stats or testimonials.
*/

export type Track = "PAYROLL" | "TAX" | "INVOICING";
export const LAST_STEP = 6;
/** Days after the previous email that each step is sent (index = step number). */
const GAP_DAYS: Record<number, number> = { 2: 2, 3: 3, 4: 3, 5: 4, 6: 4 };

export function trackFor(tool: ToolMeta): Track {
  return tool.group === "Payroll" ? "PAYROLL" : tool.group === "Tax" ? "TAX" : "INVOICING";
}

/** Business days only: Saturday and Sunday sends move to Monday morning. */
export function scheduleAfter(from: Date, days: number) {
  const d = addDays(from, days);
  if (d.getDay() === 6) d.setDate(d.getDate() + 2);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

export function nextSendFor(step: number, from = new Date()) {
  return step > LAST_STEP ? null : scheduleAfter(from, GAP_DAYS[step] ?? 3);
}

type Copy = { subject: string; preview: string; heading: string; paragraphs: string[]; button: { label: string; href: string }; after?: string[] };

function link(path: string, step: number) {
  const u = new URL(path, siteUrl());
  u.searchParams.set("utm_source", "nurture");
  u.searchParams.set("utm_medium", "email");
  u.searchParams.set("utm_campaign", `calc_${step}`);
  return u.toString();
}

const li = (items: string[]) => items.map((i) => `• ${i}`).join("<br>");

function copyFor(step: number, track: Track, tool: ToolMeta, inputs: string): Copy {
  const recap = inputs ? `A couple of days ago you used our ${esc(tool.title.toLowerCase())} (${esc(inputs)}).` : `A couple of days ago you used our ${esc(tool.title.toLowerCase())}.`;

  if (step === 2 && track === "PAYROLL") return {
    subject: "3 PAYE mistakes employers are making in 2026",
    preview: "The old relief is gone, rent relief needs proof, and PAYE follows where your staff live.",
    heading: "3 PAYE mistakes that are easy to make this year",
    paragraphs: [
      `${recap} Since the new tax rules took effect in January, three payroll mistakes have become very easy to make:`,
      `<strong>1. Still applying the old Consolidated Relief Allowance.</strong> It was abolished from 1 January 2026. The first ₦800,000 of annual taxable income is now tax-free instead.`,
      `<strong>2. Giving rent relief without evidence.</strong> Staff can deduct 20% of their annual rent (up to ₦500,000), but keep a tenancy agreement or receipt on file for every claim.`,
      `<strong>3. Paying PAYE to the wrong state.</strong> PAYE goes to the state where each employee <em>lives</em>, not where your office is, by the 10th of the next month.`,
    ],
    button: { label: "Read the full PAYE guide", href: link("/insights/how-to-calculate-paye-in-nigeria", step) },
  };

  if (step === 3 && track === "PAYROLL") return {
    subject: "What a new hire really costs (it's not just the salary)",
    preview: "Pension from 3 staff, ITF from 5, NSITF from day one, and the deadlines that come with them.",
    heading: "The real cost of an employee in Nigeria",
    paragraphs: [
      "When you budget for a hire, the salary is only part of it. On top of gross pay, the company pays:",
      li(["<strong>10% employer pension</strong> once you have 3 or more employees, remitted within 7 working days of pay day", "<strong>1% NSITF</strong> on monthly payroll", "<strong>1% ITF</strong> once you have 5+ staff or ₦50m+ turnover"]),
      "So a ₦400,000 salary costs a company with 6 staff about <strong>₦448,000 a month</strong>, before HMO, equipment and bonuses.",
      "Run your own numbers before your next offer letter:",
    ],
    button: { label: "Calculate the cost of a hire", href: link("/tools/employer-cost-calculator", step) },
  };

  if (step === 2 && track === "TAX") return {
    subject: "The 3 tax deadlines that catch companies out",
    preview: "The 10th, the 21st and 30 June, and what's due on each.",
    heading: "Three dates to put in your calendar",
    paragraphs: [
      `${recap} Knowing what you owe is half of it. The other half is paying on time, because late remittance adds penalties and interest. Most companies have three recurring deadlines:`,
      li(["<strong>10th of each month:</strong> PAYE deducted from salaries, to the State IRS", "<strong>21st of each month:</strong> VAT returns and WHT deducted from suppliers, to the Nigeria Revenue Service", "<strong>Within 6 months of year end</strong> (30 June for a December year end): company income tax and the development levy"]),
      "We've put every recurring deadline for 2026 on one page:",
    ],
    button: { label: "See the 2026 tax calendar", href: link("/insights/nigeria-tax-calendar-2026", step) },
  };

  if (step === 3 && track === "TAX") return {
    subject: "Is your company still 'small' for tax?",
    preview: "₦100m turnover, ₦250m assets, and one exclusion many consultancies miss.",
    heading: "Check your small-company status before year end",
    paragraphs: [
      "Under the Nigeria Tax Act 2025, a small company pays <strong>0% company income tax</strong> and no development levy. To qualify, you need all three:",
      li(["Annual turnover of ₦100 million or less", "Fixed assets of ₦250 million or less", "No professional services (consulting, legal, accounting, engineering and similar)"]),
      "A good quarter can push you over ₦100m without anyone noticing, and the third test surprises a lot of consultancies. It's worth checking your trailing 12 months every quarter, not just at year end.",
    ],
    button: { label: "Read the small company guide", href: link("/insights/small-company-tax-exemption-nigeria", step) },
    after: [`Or re-run the numbers with the <a href="${link("/tools/company-income-tax-calculator", step)}">company tax calculator</a>.`],
  };

  if (step === 2 && track === "INVOICING") return {
    subject: "Why your client paid less than your invoice",
    preview: "It's withholding tax, and it's still your money if you collect one document.",
    heading: "That missing 5% is still yours",
    paragraphs: [
      `${recap} When a company pays ₦1,025,000 against a ₦1,075,000 invoice, the difference is usually <strong>withholding tax</strong>: 5% of the amount before VAT for consultancy and professional fees.`,
      "WHT isn't lost money. It's an advance payment of <em>your</em> income tax. But you can only use it with the <strong>WHT credit note</strong>, the proof the client remitted it.",
      "Keep a simple list of every deduction and chase missing credit notes every quarter. Clients respond much faster soon after payment than a year later.",
    ],
    button: { label: "Read the WHT guide", href: link("/insights/withholding-tax-in-nigeria", step) },
  };

  if (step === 3 && track === "INVOICING") return {
    subject: "The reminder schedule that gets invoices paid",
    preview: "Before the due date, on it, and at 3, 7, 14 and 30 days, with wording you can copy.",
    heading: "Get paid on time without awkward calls",
    paragraphs: [
      "Late payment usually has boring causes: a missing PO number, an invoice sent to the wrong person, or nobody following up. A fixed schedule fixes most of it:",
      li(["3 days before due: a friendly heads-up with the payment link", "Due date: \"due today\"", "3 and 7 days late: ask for a payment date", "14 days: call your senior contact", "30 days: a formal letter citing your contract"]),
      "The full playbook has copy-and-paste wording for each stage:",
    ],
    button: { label: "Get the collections playbook", href: link("/insights/how-to-get-clients-to-pay-on-time", step) },
  };

  if (step === 4) return {
    subject: "A 2-hour month-end routine for your books",
    preview: "12 steps that make VAT, PAYE and year-end painless, whatever tool you use.",
    heading: "Two hours a month saves a painful year end",
    paragraphs: [
      "Most companies do their books once a year, in a panic, just before the auditor arrives. The ones that always know their numbers do a short close every month:",
      li(["Record every invoice, payment, expense and bill", "Reconcile each bank account", "Chase anything more than 30 days late", "Prepare PAYE, VAT, WHT and pension for their deadlines", "Read your profit and loss and file your receipts"]),
      track === "PAYROLL" ? "It's also when payroll mistakes are cheapest to fix." : track === "TAX" ? "It's also the easiest way to make sure tax payments are never a surprise." : "It's also when overdue invoices are easiest to collect.",
    ],
    button: { label: "Get the month-end checklist", href: link("/insights/month-end-bookkeeping-checklist", step) },
  };

  if (step === 5) return {
    subject: "What Wave and Zoho Books leave out in Nigeria",
    preview: "Invoices, payroll and tax deadlines in one place, with payments going straight to your account.",
    heading: "Your company's finances, in one clear view",
    paragraphs: [
      "Quick background: Wave stopped sending invoices and reminders for businesses outside the US and Canada, and Zoho Books has no Nigerian payroll. We built BizBooks for Nigerian companies that bill clients and pay a team:",
      li(["Invoices with VAT, WHT, PO numbers and a secure \"Pay now\" link through <strong>your own</strong> Paystack or Flutterwave", "Automatic payment reminders", "Payroll with 2026 PAYE, pension, payslips and a bank upload file", "A tax calendar with every VAT, PAYE, WHT and pension deadline and the amount to set aside", "A dashboard with cash flow, profit and who owes you"]),
      track === "PAYROLL" ? "Payroll for up to 3 people is free." : track === "TAX" ? "The tax calendar and reports are free." : "Invoicing and online payments are free.",
      "Already on Wave or Zoho Books? Import your clients, invoices and retainers from a CSV export in a few minutes.",
    ],
    button: { label: "Start free, no card needed", href: link("/signup", step) },
    after: [`Your money never passes through us. <a href="${link("/", step)}">See how it works</a>.`],
  };

  // step 6: direct offer + objection (would rather not do it themselves)
  return {
    subject: "Rather hand this to someone else?",
    preview: "Our advisors can keep your books, file your taxes and run payroll. Or do it yourself, free.",
    heading: "Two ways we can help from here",
    paragraphs: [
      "Over the last couple of weeks we've shared how to work out PAYE, stay ahead of tax deadlines and get paid on time. Some owners love doing this themselves. Others would rather never think about it again.",
      "<strong>If you'd rather hand it over,</strong> our advisory team can keep your books every month, prepare and file VAT, WHT, PAYE and annual returns, and run payroll, all from your own records. The consultation is free.",
      "<strong>If you'd rather do it yourself,</strong> BizBooks is free to start and does the maths for you.",
    ],
    button: { label: "Book a free consultation", href: link("/advisors", step) },
    after: [`Or <a href="${link("/signup", step)}">start BizBooks free</a>. This is the last email in this series.`],
  };
}

function unsubscribeUrl(token: string) {
  return new URL(`/unsubscribe?t=${encodeURIComponent(token)}`, siteUrl()).toString();
}

export function nurtureFooter(tool: ToolMeta, createdAt: Date, token: string) {
  return `You're getting this because you asked our ${esc(tool.title)} to email your results on ${formatDate(createdAt)}. <a href="${unsubscribeUrl(token)}" style="color:#6b746f">Unsubscribe</a>`;
}

export function unsubscribeHeaders(token: string) {
  return {
    "List-Unsubscribe": `<${new URL(`/api/unsubscribe?t=${encodeURIComponent(token)}`, siteUrl())}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function renderNurture(step: number, lead: { tool: string; track: string; data: unknown; createdAt: Date; token: string }) {
  const tool = TOOL_BY_SLUG[lead.tool];
  const inputs = typeof lead.data === "object" && lead.data && "inputs" in lead.data ? String((lead.data as { inputs: unknown }).inputs ?? "") : "";
  const c = copyFor(step, lead.track as Track, tool, inputs);
  const { html, text } = layout({ ...c, footer: nurtureFooter(tool, lead.createdAt, lead.token) });
  return { subject: c.subject, html, text };
}

/** Called by the daily job. Sends every due email, then schedules the next one. */
export async function runNurture(now = new Date()) {
  const out = { sent: 0, converted: 0, completed: 0 };
  const due = await db.lead.findMany({
    where: { track: { not: "NONE" }, nextNurtureAt: { lte: now }, completedAt: null, convertedAt: null, unsubscribedAt: null },
    orderBy: { nextNurtureAt: "asc" },
    take: 500,
  });
  for (const lead of due) {
    // Exit: they signed up (any time, under the same email).
    if (await db.user.findUnique({ where: { email: lead.email }, select: { id: true } })) {
      await db.lead.update({ where: { id: lead.id }, data: { convertedAt: now, nextNurtureAt: null } });
      out.converted++;
      continue;
    }
    // Exit: unsubscribed from another lead row with the same address.
    if (await db.lead.findFirst({ where: { email: lead.email, unsubscribedAt: { not: null } }, select: { id: true } })) {
      await db.lead.update({ where: { id: lead.id }, data: { unsubscribedAt: now, nextNurtureAt: null } });
      continue;
    }
    const step = lead.nurtureStep + 1;
    if (step > LAST_STEP || !TOOL_BY_SLUG[lead.tool]) {
      await db.lead.update({ where: { id: lead.id }, data: { completedAt: now, nextNurtureAt: null } });
      continue;
    }
    const { subject, html, text } = renderNurture(step, lead);
    const r = await sendEmail({ to: lead.email, subject, html, text, headers: unsubscribeHeaders(lead.token) });
    if (!r.ok) continue; // try again tomorrow
    const next = step >= LAST_STEP ? null : nextSendFor(step + 1, now);
    await db.lead.update({ where: { id: lead.id }, data: { nurtureStep: step, nextNurtureAt: next, completedAt: next ? null : now } });
    out.sent++;
    if (!next) out.completed++;
  }
  return out;
}

/** Unsubscribe every lead row for the address behind this token. */
export async function unsubscribeByToken(token: string) {
  const lead = await db.lead.findUnique({ where: { token } });
  if (!lead) return null;
  await db.lead.updateMany({ where: { email: lead.email, unsubscribedAt: null }, data: { unsubscribedAt: new Date(), nextNurtureAt: null } });
  return lead.email;
}

/** Decide whether a new calculator lead starts the sequence. Only an address's first lead does. */
export async function enrolment(email: string, tool: ToolMeta) {
  const existing = await db.lead.findFirst({ where: { email, OR: [{ track: { not: "NONE" } }, { unsubscribedAt: { not: null } }] }, select: { id: true } });
  const member = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing || member) return { track: "NONE", nextNurtureAt: null as Date | null };
  return { track: trackFor(tool), nextNurtureAt: nextSendFor(2) };
}
