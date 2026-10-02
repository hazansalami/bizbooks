import "server-only";
import { ensureReferralCode } from "./growth";
import { cache } from "react";
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
  return user;
});

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
