import "server-only";
import { db } from "./db";
import { Prisma } from "@/generated/prisma/client";
import { FREE_RECURRING_LIMIT, LIFETIME_PRO_UNTIL, REFERRAL, TRIAL } from "./constants";
import { isTrial } from "./plan";
import { addDays, addMonths } from "./utils";
import { layout, sendEmail, escapeHtml as esc } from "./email";
import { siteUrl } from "./site-url";

type Tx = Prisma.TransactionClient;
const url = (path: string) => new URL(path, siteUrl()).toString();

/* ---------- Trial ---------- */

/** New businesses start on Pro; referred ones get the longer trial. Never shortens existing Pro time. */
export async function startTrial(tx: Tx, businessId: string, referred: boolean) {
  const now = new Date();
  const ends = addDays(now, referred ? TRIAL.referredDays : TRIAL.days);
  await tx.business.update({ where: { id: businessId }, data: { plan: "PRO", proUntil: ends, trialStartedAt: now, trialEndsAt: ends } });
}

/**
 * Earn-more-days: the first time a trialing business does one of the key things, add a week to the trial.
 * Safe to call from anywhere and repeatedly; each step pays out once, and only during the trial.
 */
export async function grantTrialBonus(businessId: string, key: (typeof TRIAL.bonuses)[number]["key"]) {
  const b = await db.business.findUnique({ where: { id: businessId } });
  if (!b || !isTrial(b) || b.trialBonuses.includes(key) || !b.proUntil || b.proUntil < new Date()) return false;
  const ends = addDays(b.proUntil, TRIAL.bonusDays);
  const updated = await db.business.updateMany({
    // Guard against a double grant from two requests at once.
    where: { id: businessId, NOT: { trialBonuses: { has: key } } },
    data: { proUntil: ends, trialEndsAt: ends, trialBonuses: { push: key } },
  });
  return updated.count === 1;
}

/**
 * When Pro lapses (trial or paid), keep things honest: recurring invoices beyond the Free allowance are
 * paused, never deleted. The oldest ones keep running.
 */
export async function pauseBeyondFree(businessId: string) {
  const live = await db.recurringSchedule.findMany({ where: { businessId, status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const extra = live.slice(FREE_RECURRING_LIMIT).map((s) => s.id);
  if (extra.length) await db.recurringSchedule.updateMany({ where: { id: { in: extra } }, data: { status: "PAUSED" } });
  return extra.length;
}

/* ---------- Referral codes ---------- */

/** Short, readable, shareable: first letters of the business name plus a random tail, e.g. KOLA7Q2. */
export async function ensureReferralCode(businessId: string, name?: string) {
  const b = await db.business.findUnique({ where: { id: businessId }, select: { referralCode: true, name: true } });
  if (!b) return null;
  if (b.referralCode) return b.referralCode;
  const stem = (name ?? b.name).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "BIZ";
  for (let i = 0; i < 6; i++) {
    const code = stem + Math.random().toString(36).slice(2, 5).toUpperCase().replace(/[^A-Z0-9]/g, "X");
    try {
      const set = await db.business.updateMany({ where: { id: businessId, referralCode: null }, data: { referralCode: code } });
      if (set.count === 1) return code;
      // Another request gave this business a code first.
      return (await db.business.findUnique({ where: { id: businessId }, select: { referralCode: true } }))?.referralCode ?? null;
    } catch (e) {
      // P2002: code already taken by another business; try another.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== "P2002") throw e;
    }
  }
  return null;
}

/** Pass the transaction client when inside one: a second connection would wait on the transaction's own. */
export async function referrerByCode(code: string | null | undefined, client: Tx | typeof db = db) {
  const c = (code ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,12}$/.test(c)) return null;
  return client.business.findUnique({ where: { referralCode: c }, select: { id: true, name: true, ownerId: true } });
}

/** Called when a new business is created. Returns true if it was referred (so it gets the longer trial). */
export async function attachReferral(tx: Tx, businessId: string, ownerId: string, code: string | null | undefined, source = "LINK") {
  const referrer = await referrerByCode(code, tx);
  if (!referrer || referrer.ownerId === ownerId || referrer.id === businessId) return false;
  await tx.business.update({ where: { id: businessId }, data: { referredById: referrer.id } });
  await tx.referral.create({ data: { referrerId: referrer.id, referredId: businessId, source: source === "INVOICE" ? "INVOICE" : "LINK" } });
  return true;
}

/* ---------- Qualification ---------- */

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "yahoo.co.uk", "outlook.com", "hotmail.com", "icloud.com", "live.com", "aol.com", "proton.me", "protonmail.com", "ymail.com"]);
const domain = (email?: string | null) => (email ?? "").toLowerCase().split("@")[1] ?? "";

/**
 * Checks a referred business against the qualifying rules and pays the referrer if it passes. Called from
 * the daily job and right after the events that usually tip it over (a client opening an invoice, an
 * online payment), so rewards arrive the same day.
 */
export async function checkReferral(referredBusinessId: string) {
  const ref = await db.referral.findUnique({
    where: { referredId: referredBusinessId },
    include: {
      referred: { include: { owner: true, paymentAccount: true } },
      referrer: { include: { owner: true, paymentAccount: true } },
    },
  });
  if (!ref || ref.status !== "PENDING") return null;
  const now = new Date();
  const { referred, referrer } = ref;

  if (ref.createdAt < addDays(now, -REFERRAL.qualifyWithinDays)) {
    await db.referral.update({ where: { id: ref.id }, data: { status: "EXPIRED", reason: `Not active within ${REFERRAL.qualifyWithinDays} days` } });
    return "EXPIRED";
  }

  // Self-referral signals: the same company behind both accounts.
  const sameCac = !!referred.rcNumber && !!referrer.rcNumber && referred.rcNumber.replace(/\D/g, "") === referrer.rcNumber.replace(/\D/g, "");
  const d = domain(referred.owner.email);
  const sameDomain = !!d && !FREE_MAIL.has(d) && d === domain(referrer.owner.email);
  const sameBank = !!referred.paymentAccount && !!referrer.paymentAccount && referred.paymentAccount.accountNumber === referrer.paymentAccount.accountNumber;
  const reason = sameCac ? "Same CAC number as the referrer" : sameBank ? "Same payout account as the referrer" : sameDomain ? "Same company email domain as the referrer" : null;

  // "Sent" means actually emailed or shared (a SENT event), not just marked paid, which also stamps sentAt.
  const [sent, viewed, onlinePaid] = await Promise.all([
    db.invoice.findMany({ where: { businessId: referred.id, kind: "INVOICE", importSource: null, events: { some: { type: "SENT" } } }, select: { customerId: true } }),
    db.invoice.count({ where: { businessId: referred.id, kind: "INVOICE", viewedAt: { not: null }, importSource: null } }),
    // Paid online (BizBooks Payments or the business's own gateway): real money from a real client.
    db.payment.count({ where: { businessId: referred.id, reference: { not: null } } }),
  ]);
  const clients = new Set(sent.map((i) => i.customerId)).size;
  const active = (sent.length >= REFERRAL.minInvoices && clients >= REFERRAL.minClients && viewed >= 1) || onlinePaid >= 1;
  if (!active) return "PENDING";

  if (reason) {
    await db.referral.update({ where: { id: ref.id }, data: { status: "REJECTED", reason } });
    return "REJECTED";
  }
  // Invoices and views alone can be staged by one person with several accounts. Past the first few, a
  // referral without an online payment waits for a person to look at it (approve or reject in /admin).
  if (onlinePaid === 0) {
    const auto = await db.referral.count({ where: { referrerId: referrer.id, status: "QUALIFIED", reason: null } });
    if (auto >= REFERRAL.autoQualifyWithoutPayment) {
      await db.referral.update({ where: { id: ref.id }, data: { status: "REVIEW", reason: "Active, but no online payment yet: check it's a real, separate business" } });
      return "REVIEW";
    }
  }
  await qualify(ref.id);
  return "QUALIFIED";
}

/** Pay the referrer: Pro months (banked up to the cap), fee-free payments, and any milestone reward. */
export async function qualify(referralId: string, opts: { byAdmin?: boolean } = {}) {
  const result = await db.$transaction(async (tx) => {
    const ref = await tx.referral.findUniqueOrThrow({ where: { id: referralId }, include: { referrer: { include: { paymentAccount: true } }, referred: true } });
    if (ref.status === "QUALIFIED") return null;
    const r = ref.referrer;
    const now = new Date();
    const qualifiedBefore = await tx.referral.count({ where: { referrerId: r.id, status: "QUALIFIED" } });
    const count = qualifiedBefore + 1;
    const milestone = REFERRAL.milestones.find((m) => m.count === count);

    let months: number = REFERRAL.rewardMonths;
    if (milestone && "bonusMonths" in milestone) months += milestone.bonusMonths;
    const lifetime = !!milestone && "lifetime" in milestone && milestone.lifetime;
    const alreadyLifetime = !!r.proUntil && r.proUntil >= LIFETIME_PRO_UNTIL;
    const base = r.plan === "PRO" && r.proUntil && r.proUntil > now ? r.proUntil : now;
    const cap = addMonths(now, REFERRAL.bankCapMonths);
    const proUntil = lifetime || alreadyLifetime ? LIFETIME_PRO_UNTIL : new Date(Math.min(addMonths(base, months).getTime(), Math.max(cap.getTime(), base.getTime())));

    await tx.business.update({
      where: { id: r.id },
      data: {
        plan: "PRO", proUntil, cancelAtEnd: false, renewalNoticeAt: null,
        ...(r.paymentAccount ? {} : { feeFreeBonus: { increment: REFERRAL.rewardFeeFree } }),
      },
    });
    if (r.paymentAccount) await tx.paymentAccount.update({ where: { id: r.paymentAccount.id }, data: { feeFreeLeft: { increment: REFERRAL.rewardFeeFree } } });
    await tx.referral.update({ where: { id: ref.id }, data: { status: "QUALIFIED", qualifiedAt: now, rewardMonths: lifetime ? 0 : months, rewardFeeFree: REFERRAL.rewardFeeFree, reason: opts.byAdmin ? "Approved by BizBooks" : null } });
    return { referrerId: r.id, referrerEmail: r.email, referredName: ref.referred.name, months, lifetime, milestone: milestone?.label ?? null, count, proUntil };
  });
  if (result) await emailReward(result);
  return result;
}

async function emailReward(r: { referrerId: string; referrerEmail: string | null; referredName: string; months: number; lifetime: boolean; milestone: string | null; count: number; proUntil: Date }) {
  const owner = await db.business.findUnique({ where: { id: r.referrerId }, include: { owner: true } });
  if (!owner) return;
  const heading = r.lifetime ? "You've earned Pro for life" : `You've earned ${r.months} months of Pro`;
  const { html, text } = layout({
    heading,
    preview: `${r.referredName} is up and running on BizBooks, thanks to you.`,
    paragraphs: [
      `Hi ${esc(owner.owner.fullName.split(" ")[0])}, ${esc(r.referredName)} is now sending invoices with BizBooks. Thank you for the introduction.`,
      r.lifetime
        ? `That's ${r.count} businesses you've brought in, so ${esc(owner.name)} now has <strong>BizBooks Pro free for life</strong>.`
        : `We've added <strong>${r.months} months of Pro</strong> and <strong>${REFERRAL.rewardFeeFree} fee-free BizBooks Payments</strong> to ${esc(owner.name)}.${r.milestone ? ` You also hit a milestone: <strong>${esc(r.milestone)}</strong>.` : ""}`,
    ],
    button: { label: "See your referrals", href: url("/app/refer") },
  });
  await sendEmail({ to: owner.email || owner.owner.email, subject: heading, html, text });
}
