import "server-only";
import { ensureReferralCode } from "./growth";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, include: { business: true } });
  // A session from before the latest password change or "sign out of all devices" is no longer valid
  // (JWT iat has 1-second precision, so compare whole seconds).
  const cutoff = Math.max(user?.passwordChangedAt?.getTime() ?? 0, user?.sessionsRevokedAt?.getTime() ?? 0);
  if (cutoff && (session.issuedAt ?? 0) < Math.floor(cutoff / 1000) * 1000) return null;
  if (!user) return null;

  // Which business this session is working in: the user's own, or one they're a member of (an accountant
  // looking after several companies picks one on /accountant). Membership is checked on every request.
  const ownBusiness = user.business;
  let business = ownBusiness;
  let role: Role = "OWNER";
  const active = (await cookies()).get(ACTIVE_BUSINESS_COOKIE)?.value;
  if (active && active !== ownBusiness?.id) {
    const m = await db.membership.findUnique({ where: { userId_businessId: { userId: user.id, businessId: active } }, include: { business: true } });
    if (m) { business = m.business; role = "ACCOUNTANT"; }
  } else if (!ownBusiness) {
    const m = await db.membership.findFirst({ where: { userId: user.id }, include: { business: true }, orderBy: { createdAt: "asc" } });
    if (m) { business = m.business; role = "ACCOUNTANT"; }
  }
  return { ...user, business, ownBusiness, role };
});

export type Role = "OWNER" | "ACCOUNTANT";
export const ACTIVE_BUSINESS_COOKIE = "bb_business";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Signed in with a business. Sends new owners to the setup wizard until they finish or skip it. */
export async function requireBusiness(opts: { allowOnboarding?: boolean } = {}) {
  const user = await requireUser();
  const business = user.business;
  if (!business) redirect("/onboarding");
  if (!business.onboardedAt && !opts.allowOnboarding) redirect("/onboarding");
  if (!business.referralCode) business.referralCode = await ensureReferralCode(business.id, business.name);
  // Cheap activity heartbeat for the churn-risk checks in the daily job.
  if (Date.now() - business.lastActiveAt.getTime() > 3600_000) {
    await db.business.update({ where: { id: business.id }, data: { lastActiveAt: new Date() } });
  }
  return { user, business };
}

export type CurrentBusiness = Awaited<ReturnType<typeof requireBusiness>>["business"];

/**
 * Owner only: billing, the bank accounts clients pay into, payment gateways and who has access. An
 * accountant can keep the books but can't redirect the company's money or its subscription.
 */
export async function requireOwner(opts: { allowOnboarding?: boolean } = {}) {
  const r = await requireBusiness(opts);
  if (r.user.role !== "OWNER") redirect("/app/settings");
  return r;
}
