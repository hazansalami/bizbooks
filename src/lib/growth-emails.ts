import "server-only";
import { db } from "./db";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";
import { isTrial } from "./plan";
import { PLANS, TRIAL, REFERRAL } from "./constants";
import { naira } from "./money";
import { checkReferral } from "./growth";
import { addDays, daysBetween, formatDate } from "./utils";

const url = (path: string) => new URL(path, siteUrl()).toString();

/*
  Trial lifecycle emails, one per business per run at most. Early steps count from the start; later ones
  count back from the end, because earned bonus days move the end date.
    1: day 3   first steps (earn-more-days)
    2: day 10  automation: recurring invoices and reminders
    3: 7 days left  what BizBooks did for you
    4: 2 days left  keep Pro (annual plan)
    5: trial over  sent by the daily job when it moves the business to Free (trialEndedEmail)
*/
export async function runTrialEmails(now = new Date()) {
  const trialing = await db.business.findMany({
    where: { plan: "PRO", trialEndsAt: { not: null }, trialStartedAt: { not: null }, trialEmailStep: { lt: 4 } },
    include: { owner: true },
    take: 500,
  });
  let sent = 0;
  for (const b of trialing) {
    if (!isTrial(b) || !b.proUntil || b.proUntil < now) continue;
    const age = daysBetween(b.trialStartedAt!, now);
    const left = daysBetween(now, b.proUntil);
    const step = left <= 2 ? 4 : left <= 7 ? 3 : age >= 10 ? 2 : age >= 3 ? 1 : 0;
    if (step <= b.trialEmailStep) continue;
    const first = esc(b.owner.fullName.split(" ")[0]);
    const done = new Set(b.trialBonuses);
    let mail: { subject: string; heading: string; paragraphs: string[]; button: { label: string; href: string }; after?: string[] };

    if (step === 1) {
      const next = TRIAL.bonuses.find((x) => !done.has(x.key));
      mail = {
        subject: next ? `Earn ${TRIAL.bonusDays} more days of Pro` : "You're set up like a pro",
        heading: next ? `${next.label} and get ${TRIAL.bonusDays} more days of Pro` : "You've unlocked every trial bonus",
        paragraphs: next
          ? [`Hi ${first}, your BizBooks Pro trial has ${left} days left. Each of these adds a week:`, TRIAL.bonuses.map((x) => `${done.has(x.key) ? "✓" : "•"} ${x.label}`).join("<br>")]
          : [`Hi ${first}, you've earned every bonus week. Your trial now runs to ${formatDate(b.proUntil)}.`],
        button: next ? { label: next.label, href: url(next.key === "FIRST_INVOICE" ? "/app/invoices/new" : next.key === "GET_PAID" ? "/app/settings/payments" : "/app/payroll") } : { label: "Open BizBooks", href: url("/app") },
      };
    } else if (step === 2) {
      mail = {
        subject: "Stop chasing payments by hand",
        heading: "Let BizBooks do the chasing",
        paragraphs: [
          `Hi ${first}, two Pro features that save most owners hours each month:`,
          "<strong>Automatic reminders</strong> go out before and after the due date, with a Pay now link.<br><strong>Recurring invoices</strong> send your retainers on the same day every month, without you lifting a finger.",
        ],
        button: { label: "Set up a recurring invoice", href: url("/app/recurring/new") },
      };
    } else if (step === 3) {
      const since = b.trialStartedAt!;
      const [inv, paid, reminders] = await Promise.all([
        db.invoice.findMany({ where: { businessId: b.id, kind: "INVOICE", importSource: null, createdAt: { gte: since }, status: { not: "VOID" } }, select: { total: true, exchangeRate: true } }),
        db.payment.findMany({ where: { businessId: b.id, paidAt: { gte: since } }, select: { amount: true, exchangeRate: true } }),
        db.invoiceEvent.count({ where: { type: "REMINDER", createdAt: { gte: since }, invoice: { businessId: b.id } } }),
      ]);
      const invoiced = inv.reduce((s, i) => s + i.total * i.exchangeRate, 0);
      const collected = paid.reduce((s, p) => s + p.amount * p.exchangeRate, 0);
      mail = {
        subject: `${left} days left of your Pro trial`,
        heading: inv.length ? `You invoiced ${naira(Math.round(invoiced))} with BizBooks` : "A week left of Pro",
        paragraphs: inv.length
          ? [`Hi ${first}, here's your trial so far:`, `${inv.length} invoice${inv.length === 1 ? "" : "s"} sent · ${naira(Math.round(collected))} collected · ${reminders} reminder${reminders === 1 ? "" : "s"} sent for you`, `Keep reminders, recurring invoices and full payroll after ${formatDate(b.proUntil)}.`]
          : [`Hi ${first}, your Pro trial ends on ${formatDate(b.proUntil)}. There's still time to send your first invoice and see how fast clients pay with a Pay now link.`],
        button: { label: "Keep Pro", href: url("/app/settings/billing") },
        after: [`Pro is ${naira(PLANS.PRO.monthly)} a month, or ${naira(PLANS.PRO.yearly)} a year (two months free). No automatic charges.`],
      };
    } else {
      mail = {
        subject: "Your Pro trial ends in 2 days",
        heading: "Keep Pro for less: two months free on the yearly plan",
        paragraphs: [
          `Hi ${first}, your Pro trial ends on ${formatDate(b.proUntil)}.`,
          `Take the yearly plan for ${naira(PLANS.PRO.yearly)}, two months free compared with monthly. Or stay on Free: your books, clients and invoices stay, and automatic reminders and extra recurring invoices pause until you upgrade.`,
        ],
        button: { label: "Keep Pro", href: url("/app/settings/billing") },
        after: [`Or earn Pro for free: every business you refer that gets going gives you ${REFERRAL.rewardMonths} months. <a href="${url("/app/refer")}">Your referral link</a>`],
      };
    }
    const { html, text } = layout({ heading: mail.heading, paragraphs: mail.paragraphs, button: mail.button, after: mail.after, preview: mail.subject });
    await sendEmail({ to: b.owner.email, subject: mail.subject, html, text });
    await db.business.update({ where: { id: b.id }, data: { trialEmailStep: step } });
    sent++;
  }
  return sent;
}

/** Sent when a trial ends and the business moves to Free. Honest about what's kept and what's paused. */
export async function trialEndedEmail(businessId: string, paused: number) {
  const b = await db.business.findUnique({ where: { id: businessId }, include: { owner: true } });
  if (!b) return;
  const { html, text } = layout({
    heading: "Your Pro trial has ended",
    preview: "Your books are safe. Here's what changes on the Free plan.",
    paragraphs: [
      `Hi ${esc(b.owner.fullName.split(" ")[0])}, ${esc(b.name)} is now on the Free plan. Everything you've created stays: clients, invoices, expenses and reports.`,
      `What pauses: automatic reminders${paused ? `, and ${paused} recurring invoice${paused === 1 ? "" : "s"} beyond the Free allowance (paused, not deleted)` : ""}, and payroll beyond 3 people.`,
      "Upgrade any time and it all switches straight back on.",
    ],
    button: { label: "Restore Pro", href: url("/app/settings/billing") },
    after: [`Prefer not to pay? Refer another business: when they get going you get ${REFERRAL.rewardMonths} months of Pro. <a href="${url("/app/refer")}">Your referral link</a>`],
  });
  await sendEmail({ to: b.owner.email, subject: "Your Pro trial has ended (your books are safe)", html, text });
  await db.business.update({ where: { id: b.id }, data: { trialEmailStep: 5 } });
}

/** One well-timed ask per business: the day after its first paid invoice, when BizBooks just proved itself. */
export async function runReferralPrompts(now = new Date()) {
  const candidates = await db.business.findMany({
    where: {
      referralPromptedAt: null, referralCode: { not: null },
      invoices: { some: { kind: "INVOICE", status: "PAID", importSource: null, paidAt: { lt: addDays(now, -1) } } },
    },
    include: { owner: true },
    take: 200,
  });
  for (const b of candidates) {
    const link = url(`/r/${b.referralCode}`);
    const { html, text } = layout({
      heading: "Paid. Know another business still chasing invoices?",
      paragraphs: [
        `Hi ${esc(b.owner.fullName.split(" ")[0])}, nice one: a client just paid ${esc(b.name)}.`,
        `If you know a business that still chases payments by hand, send them your link. They get ${TRIAL.referredDays} days of Pro free, and once they're up and running you get ${REFERRAL.rewardMonths} months of Pro and ${REFERRAL.rewardFeeFree} fee-free payments.`,
      ],
      button: { label: "Share on WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(`I use BizBooks for invoices and getting paid. Get ${TRIAL.referredDays} days of Pro free with my link: ${link}`)}` },
      after: [`Your link: <a href="${link}">${link}</a>`],
    });
    await sendEmail({ to: b.owner.email, subject: "Know another business still chasing invoices?", html, text });
    await db.business.update({ where: { id: b.id }, data: { referralPromptedAt: now } });
  }
  return candidates.length;
}

/** Daily sweep so referrals qualify (or expire) even without a triggering event. */
export async function sweepReferrals() {
  const pending = await db.referral.findMany({ where: { status: "PENDING" }, select: { referredId: true }, take: 1000 });
  let qualified = 0;
  for (const p of pending) if ((await checkReferral(p.referredId)) === "QUALIFIED") qualified++;
  return qualified;
}
