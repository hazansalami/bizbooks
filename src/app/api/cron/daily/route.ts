import { pauseBeyondFree } from "@/lib/growth";
import { runReferralPrompts, runTrialEmails, sweepReferrals, trialEndedEmail } from "@/lib/growth-emails";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runSchedule } from "@/lib/recurring";
import { clearOldRateEvents } from "@/lib/rate-limit";
import { runPromiseChecks, whatsappReminder } from "@/lib/collections";
import { runExpiryReminders } from "@/lib/compliance";
import { runRecurringExpense } from "@/lib/recurring-expenses";
import { runNurture } from "@/lib/nurture";
import { emailInvoice, loadFullInvoice } from "@/lib/invoices";
import { isPro, isTrial } from "@/lib/plan";
import { layout, sendEmail, escapeHtml as esc } from "@/lib/email";
import { balanceDue, naira } from "@/lib/money";
import { siteUrl } from "@/lib/site-url";
import { addDays, daysBetween, formatDate, startOfDay } from "@/lib/utils";
import { FREE_RECURRING_EXPENSE_LIMIT, FREE_RECURRING_LIMIT, RENEWAL_GRACE_DAYS } from "@/lib/constants";

export const maxDuration = 300;

/** Days relative to the due date when Pro sends automatic reminders: the day before, then 3 and 7 days late. */
const REMINDER_DAYS = [-1, 3, 7];

/**
 * Runs once a day (vercel.json). Every step is safe to re-run: each one records what it did
 * (nextRunAt, lastReminderAt, renewalNoticeAt, lastNudgeAt) and skips work already done today.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const now = new Date();
  const today = startOfDay(now);
  const endOfToday = addDays(today, 1);
  const out = { recurring: 0, recurringExpenses: 0, reminders: 0, renewalNotices: 0, downgraded: 0, nudges: 0, errors: 0 };

  // 1. Recurring invoices due today (or missed while the job was down).
  const due = await db.recurringSchedule.findMany({ where: { status: "ACTIVE", nextRunAt: { lt: endOfToday } }, include: { business: true }, take: 500 });
  for (const s of due) {
    try {
      if (!isPro(s.business)) {
        // Free plan keeps its oldest schedules running, up to the Free allowance.
        const allowed = await db.recurringSchedule.findMany({ where: { businessId: s.businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: FREE_RECURRING_LIMIT, select: { id: true } });
        if (!allowed.some((a) => a.id === s.id)) continue;
      }
      if (await runSchedule(s.id)) out.recurring++;
    } catch (e) {
      out.errors++;
      console.error("recurring", s.id, e);
    }
  }

  // 1b. Recurring expenses due today: rent, subscriptions, retainers.
  const costs = await db.recurringExpense.findMany({ where: { status: "ACTIVE", nextRunAt: { lt: endOfToday } }, include: { business: true }, take: 1000 });
  for (const r of costs) {
    try {
      if (!isPro(r.business)) {
        const allowed = await db.recurringExpense.findMany({ where: { businessId: r.businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, take: FREE_RECURRING_EXPENSE_LIMIT, select: { id: true } });
        if (!allowed.some((a) => a.id === r.id)) continue;
      }
      if (await runRecurringExpense(r.id)) out.recurringExpenses++;
    } catch (e) {
      out.errors++;
      console.error("recurring expense", r.id, e);
    }
  }

  // 2. Automatic payment reminders (Pro).
  const open = await db.invoice.findMany({
    where: {
      kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] }, importSource: null,
      // Someone to remind: an email address, or a phone number when WhatsApp reminders are on.
      AND: [{ OR: [{ customer: { email: { not: null } } }, { customer: { phone: { not: null } }, business: { whatsappReminders: true } }] }],
      business: { autoReminders: true, plan: "PRO" },
      OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: today } }],
      dueDate: { gte: addDays(today, -8), lt: addDays(today, 2) },
    },
    include: { business: true },
    take: 1000,
  });
  for (const inv of open) {
    if (!isPro(inv.business) || !REMINDER_DAYS.includes(daysBetween(inv.dueDate, now))) continue;
    try {
      const full = await loadFullInvoice(inv.id);
      if (!full) continue;
      const emailed = full.customer.email ? (await emailInvoice(full, "reminder")).ok : false;
      const whatsapped = await whatsappReminder(full);
      if (whatsapped && !emailed) await db.invoice.update({ where: { id: full.id }, data: { lastReminderAt: new Date(), reminderCount: { increment: 1 } } });
      if (emailed || whatsapped) out.reminders++;
    } catch (e) {
      out.errors++;
      console.error("reminder", inv.id, e);
    }
  }

  // 3. Pro renewals: we never auto-charge, so remind 7 days and 1 day before, then on expiry. After grace, move to Free.
  const pros = await db.business.findMany({ where: { plan: "PRO", proUntil: { not: null } }, include: { owner: true } });
  for (const b of pros) {
    const left = daysBetween(now, b.proUntil!);
    const noticedToday = b.renewalNoticeAt && b.renewalNoticeAt >= today;
    // Trials end on the day; paid plans get a grace period. Either way extras pause, nothing is deleted.
    const trial = isTrial(b);
    if (trial ? b.proUntil! < now : b.proUntil!.getTime() + RENEWAL_GRACE_DAYS * 86400000 < now.getTime()) {
      await db.business.update({ where: { id: b.id }, data: { plan: "FREE", cancelAtEnd: false } });
      const paused = await pauseBeyondFree(b.id);
      if (trial) await trialEndedEmail(b.id, paused);
      out.downgraded++;
      continue;
    }
    // Trials get their own emails (lib/growth-emails.ts).
    if (trial) continue;
    if (b.cancelAtEnd || noticedToday || (b.pausedUntil && b.pausedUntil > now) || ![7, 1, 0].includes(left)) continue;
    const { html, text } = layout({
      heading: left > 0 ? `Your BizBooks Pro ends in ${left} day${left > 1 ? "s" : ""}` : "Your BizBooks Pro ends today",
      paragraphs: [
        `Hi ${esc(b.owner.fullName.split(" ")[0])}, your Pro plan for ${esc(b.name)} runs until ${formatDate(b.proUntil)}.`,
        "Renew to keep automatic reminders and all your recurring invoices running. We never charge you automatically, so nothing happens unless you choose to renew.",
      ],
      button: { label: "Renew Pro", href: new URL("/app/settings/billing", siteUrl()).toString() },
      after: [`If you don't renew, you'll move to the Free plan after a ${RENEWAL_GRACE_DAYS}-day grace period. Your data stays.`],
    });
    await sendEmail({ to: b.email || b.owner.email, subject: left > 0 ? `Pro ends in ${left} day${left > 1 ? "s" : ""}` : "Pro ends today", html, text });
    await db.business.update({ where: { id: b.id }, data: { renewalNoticeAt: now } });
    out.renewalNotices++;
  }

  // 4. Churn-risk nudges, at most once a month and only when there's something useful to say.
  const quiet = await db.business.findMany({
    where: {
      onboardedAt: { not: null },
      lastActiveAt: { lt: addDays(now, -14) },
      OR: [{ lastNudgeAt: null }, { lastNudgeAt: { lt: addDays(now, -30) } }],
    },
    include: { owner: true, invoices: { where: { kind: "INVOICE", status: { in: ["SENT", "PARTIAL"] } } } },
    take: 300,
  });
  for (const b of quiet) {
    const owed = b.invoices.reduce((s, i) => s + balanceDue(i) * i.exchangeRate, 0);
    const late = b.invoices.filter((i) => i.dueDate < now).length;
    const sentAny = await db.invoice.count({ where: { businessId: b.id, sentAt: { not: null } } });
    const first = esc(b.owner.fullName.split(" ")[0]);
    const msg = owed > 0
      ? layout({
          heading: `${naira(owed)} is still owed to ${b.name}`,
          paragraphs: [`Hi ${first}, ${late > 0 ? `${late} invoice${late > 1 ? "s are" : " is"} past the due date.` : "some invoices are still open."} A quick WhatsApp reminder from your dashboard usually does it. It's one tap.`],
          button: { label: "See who owes you", href: new URL("/app/invoices?filter=unpaid", siteUrl()).toString() },
        })
      : !sentAny
        ? layout({
            heading: "Your first invoice takes about a minute",
            paragraphs: [`Hi ${first}, ${esc(b.name)} is set up but you haven't sent an invoice yet. Try one for your next job. Send it on WhatsApp and see how fast customers pay when there's a “Pay now” button.`],
            button: { label: "Create an invoice", href: new URL("/app/invoices/new", siteUrl()).toString() },
          })
        : null;
    if (!msg) continue;
    await sendEmail({ to: b.email || b.owner.email, subject: owed > 0 ? `${naira(owed)} still owed to you` : "Send your first invoice", html: msg.html, text: msg.text });
    await db.business.update({ where: { id: b.id }, data: { lastNudgeAt: now } });
    out.nudges++;
  }

  // 5. Growth: trial emails, the one-time referral ask, and referral qualification.
  const growth = { trialEmails: 0, referralPrompts: 0, referralsQualified: 0 };
  try {
    growth.trialEmails = await runTrialEmails(now);
    growth.referralPrompts = await runReferralPrompts(now);
    growth.referralsQualified = await sweepReferrals();
  } catch (e) {
    out.errors++;
    console.error("growth", e);
  }

  // 5a. Payment promises: settle kept ones, chase missed ones.
  let promises = { kept: 0, missed: 0 };
  try {
    promises = await runPromiseChecks(now);
  } catch (e) {
    out.errors++;
    console.error("promises", e);
  }

  // 5c. Company documents about to expire (compliance tracking).
  let documents = { sent: 0 };
  try {
    documents = await runExpiryReminders(now);
  } catch (e) {
    out.errors++;
    console.error("documents", e);
  }

  // 5b. Housekeeping: rate-limit counters older than a day are never read again.
  try {
    await clearOldRateEvents();
  } catch (e) {
    out.errors++;
    console.error("rate events", e);
  }

  // 6. Calculator lead nurture emails (lib/nurture.ts).
  let nurture = { sent: 0, converted: 0, completed: 0 };
  try {
    nurture = await runNurture(now);
  } catch (e) {
    out.errors++;
    console.error("nurture", e);
  }

  return NextResponse.json({ ok: true, ...out, growth, nurture, promises, documents });
}
