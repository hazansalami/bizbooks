import { PLANS, RENEWAL_GRACE_DAYS } from "./constants";

type PlanFields = { plan: string; proUntil: Date | null; pausedUntil: Date | null; discountPercent: number; discountUntil: Date | null; trialEndsAt?: Date | null };

/** On the Pro trial and hasn't paid or earned time beyond it. */
export function isTrial(b: PlanFields) {
  return b.plan === "PRO" && !!b.trialEndsAt && !!b.proUntil && b.proUntil.getTime() <= b.trialEndsAt.getTime();
}

/** Pro features are on while paid time remains, plus a short grace period for late renewals. */
export function isPro(b: PlanFields, now = new Date()) {
  if (b.plan !== "PRO" || !b.proUntil) return false;
  if (b.pausedUntil && b.pausedUntil > now) return false;
  // Trials end on the day; the renewal grace period is only for paying customers.
  if (isTrial(b)) return b.proUntil > now;
  return b.proUntil.getTime() + RENEWAL_GRACE_DAYS * 86400000 > now.getTime();
}

export function inGracePeriod(b: PlanFields, now = new Date()) {
  return isPro(b, now) && !!b.proUntil && b.proUntil < now;
}

export function renewalPrice(b: PlanFields, months: 1 | 12, now = new Date()) {
  const base = months === 12 ? PLANS.PRO.yearly : PLANS.PRO.monthly;
  const discounted = b.discountPercent > 0 && b.discountUntil && b.discountUntil > now && months === 1;
  return discounted ? Math.round(base * (1 - b.discountPercent / 100)) : base;
}
