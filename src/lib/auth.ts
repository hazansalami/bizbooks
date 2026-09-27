import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "./db";
import { readSession } from "./session";

export const getCurrentUser = cache(async () => {
  const session = await readSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.userId }, include: { business: true } });
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
  // Cheap activity heartbeat for the churn-risk checks in the daily job.
  if (Date.now() - business.lastActiveAt.getTime() > 3600_000) {
    await db.business.update({ where: { id: business.id }, data: { lastActiveAt: new Date() } });
  }
  return { user, business };
}

export type CurrentBusiness = Awaited<ReturnType<typeof requireBusiness>>["business"];
