import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./auth";
import { db } from "./db";
import { isPro, inGracePeriod } from "./plan";
import { addDays } from "./utils";

/*
  The platform owner's dashboard at /admin. Access is an allowlist in ADMIN_EMAILS (comma-separated),
  so there's no admin flag to escalate through the database. Everyone else gets a 404, which hides the page exists.
*/

export function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !adminEmails().includes(user.email.toLowerCase())) notFound();
  return user;
}

export async function logAdmin(adminEmail: string, action: string, businessId: string | null, detail?: string) {
  await db.adminAction.create({ data: { adminEmail, action, businessId, detail: detail ?? null } });
}

export type Risk = { level: 3 | 2 | 1; reason: string };

type RiskInput = {
  plan: string; proUntil: Date | null; pausedUntil: Date | null; discountPercent: number; discountUntil: Date | null;
  cancelAtEnd: boolean; onboardedAt: Date | null; createdAt: Date; lastActiveAt: Date;
};

/** Why a business might leave, most serious first. 3 = act now, 2 = watch, 1 = nudge. */
export function risksFor(b: RiskInput, sentInvoices: number, now = new Date()): Risk[] {
  const out: Risk[] = [];
  const days = (d: Date) => Math.floor((now.getTime() - d.getTime()) / 86400000);
  const pro = isPro(b, now);
  if (b.cancelAtEnd && pro) out.push({ level: 3, reason: "Cancelling at the end of the paid period" });
  if (inGracePeriod(b, now)) out.push({ level: 3, reason: "Pro has expired; in the renewal grace period" });
  else if (pro && b.proUntil && b.proUntil < addDays(now, 7) && !b.cancelAtEnd) {
    out.push({ level: 3, reason: `Pro renews in ${Math.max(0, Math.ceil((b.proUntil.getTime() - now.getTime()) / 86400000))} days` });
  }
  if (b.pausedUntil && b.pausedUntil > now) out.push({ level: 2, reason: "Paused their plan" });
  const quiet = days(b.lastActiveAt);
  if (b.onboardedAt && quiet >= 30) out.push({ level: pro ? 3 : 2, reason: `No activity for ${quiet} days` });
  else if (b.onboardedAt && quiet >= 14) out.push({ level: 2, reason: `No activity for ${quiet} days` });
  if (b.onboardedAt && sentInvoices === 0 && days(b.onboardedAt) >= 7) out.push({ level: 2, reason: "Set up a week ago but never sent an invoice" });
  if (!b.onboardedAt && days(b.createdAt) >= 3) out.push({ level: 1, reason: "Never finished setup" });
  return out.sort((a, c) => c.level - a.level);
}

export function planLabel(b: RiskInput, now = new Date()) {
  if (b.plan !== "PRO") return "Free";
  if (b.pausedUntil && b.pausedUntil > now) return "Pro (paused)";
  if (inGracePeriod(b, now)) return "Pro (grace)";
  if (isPro(b, now)) return b.cancelAtEnd ? "Pro (cancelling)" : "Pro";
  return "Pro (lapsed)";
}

export type BusinessRow = Awaited<ReturnType<typeof loadBusinessRows>>[number];

/** Every business with the numbers the admin lists need. Fine into the low thousands; paginate in SQL beyond that. */
export async function loadBusinessRows(now = new Date()) {
  const [businesses, sent, invoices] = await Promise.all([
    db.business.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, industry: true, teamSize: true, plan: true, proUntil: true, pausedUntil: true, discountPercent: true, discountUntil: true,
        cancelAtEnd: true, onboardedAt: true, createdAt: true, lastActiveAt: true, owner: { select: { email: true, fullName: true, phone: true } },
      },
    }),
    db.invoice.groupBy({ by: ["businessId"], where: { sentAt: { not: null }, importSource: null }, _count: { _all: true } }),
    db.invoice.groupBy({ by: ["businessId"], where: { kind: "INVOICE", status: { not: "VOID" }, importSource: null }, _count: { _all: true }, _sum: { total: true } }),
  ]);
  const sentBy = new Map(sent.map((s) => [s.businessId, s._count._all]));
  const invBy = new Map(invoices.map((s) => [s.businessId, { count: s._count._all, value: s._sum.total ?? 0 }]));
  return businesses.map((b) => {
    const risks = risksFor(b, sentBy.get(b.id) ?? 0, now);
    return {
      ...b, plan: planLabel(b, now), pro: isPro(b, now), risks, riskLevel: risks[0]?.level ?? 0,
      invoiceCount: invBy.get(b.id)?.count ?? 0, invoiceValue: invBy.get(b.id)?.value ?? 0,
    };
  });
}

/**
 * One query at a time: two dozen parallel queries exhaust small connection pools
 * (serverless Postgres, the local dev database). Each is fast, so this stays quick.
 */
export async function inSequence<T extends readonly (() => Promise<unknown>)[]>(tasks: T): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: unknown[] = [];
  for (const t of tasks) out.push(await t());
  return out as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> };
}
