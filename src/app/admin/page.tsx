import Link from "next/link";
import { db } from "@/lib/db";
import { inSequence, loadBusinessRows, requireAdmin } from "@/lib/admin";
import { setAdvisorStatus } from "@/app/actions/admin";
import { adminReviewPaymentAccount } from "@/app/actions/payments";
import { adminReferralDecision } from "@/app/actions/referrals";
import { ColumnChart } from "@/components/charts";
import { Badge } from "@/components/ui";
import { isPro } from "@/lib/plan";
import { naira, nairaShort } from "@/lib/money";
import { VIZ } from "@/lib/viz";
import { addDays, cn, formatDate, timeAgo } from "@/lib/utils";

export const metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const ONLINE = ["PAYSTACK", "FLUTTERWAVE"];

export default async function AdminOverview() {
  // Checked here as well as in the layout: a client-side navigation can fetch this page without the layout re-running.
  await requireAdmin();
  const now = new Date();
  const d7 = addDays(now, -7);
  const d30 = addDays(now, -30);
  const weeksAgo = addDays(now, -7 * 12);

  const [
    rows, signups7, signups30, active7, pros, paidAll, paid30, proPayments,
    inv30, invAll, quotes30, payGroups, payroll30, employees, leadsAll, leads30, leadsConverted,
    advisor, feedback, actions, weeklyUsers, weeklyInvoices, imported, platform30, payAccounts, toReview,
    refStatus, refs30, recentRefs, trialPayers,
  ] = await inSequence([
    () => loadBusinessRows(now),
    () => db.user.count({ where: { createdAt: { gte: d7 } } }),
    () => db.user.count({ where: { createdAt: { gte: d30 } } }),
    () => db.business.count({ where: { onboardedAt: { not: null }, lastActiveAt: { gte: d7 } } }),
    () => db.business.findMany({ where: { plan: "PRO" }, select: { id: true, plan: true, proUntil: true, pausedUntil: true, discountPercent: true, discountUntil: true, cancelAtEnd: true } }),
    () => db.platformPayment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    () => db.platformPayment.aggregate({ where: { status: "PAID", paidAt: { gte: d30 } }, _sum: { amount: true }, _count: { _all: true } }),
    () => db.platformPayment.findMany({ where: { status: "PAID" }, orderBy: { paidAt: "desc" }, select: { businessId: true, amount: true, months: true } }),
    () => db.invoice.findMany({ where: { kind: "INVOICE", importSource: null, status: { not: "VOID" }, createdAt: { gte: d30 } }, select: { total: true, exchangeRate: true } }),
    () => db.invoice.count({ where: { kind: "INVOICE", importSource: null, status: { not: "VOID" } } }),
    () => db.invoice.count({ where: { kind: "QUOTE", createdAt: { gte: d30 } } }),
    () => db.payment.findMany({ where: { paidAt: { gte: d30 }, invoice: { importSource: null } }, select: { method: true, amount: true, exchangeRate: true } }),
    () => db.payRun.aggregate({ where: { status: "PAID", paidAt: { gte: d30 } }, _count: { _all: true }, _sum: { gross: true } }),
    () => db.employee.count(),
    () => db.lead.count(),
    () => db.lead.count({ where: { createdAt: { gte: d30 } } }),
    () => db.lead.count({ where: { convertedAt: { not: null } } }),
    () => db.advisorRequest.findMany({ where: { status: { in: ["NEW", "CONTACTED"] } }, orderBy: { createdAt: "desc" }, take: 10 }),
    () => db.cancellationFeedback.findMany({ orderBy: { createdAt: "desc" }, take: 6, include: { business: { select: { id: true, name: true } } } }),
    () => db.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
    () => db.user.findMany({ where: { createdAt: { gte: weeksAgo } }, select: { createdAt: true } }),
    () => db.invoice.findMany({ where: { kind: "INVOICE", importSource: null, createdAt: { gte: weeksAgo } }, select: { createdAt: true } }),
    () => db.invoice.count({ where: { importSource: { not: null } } }),
    () => db.payment.findMany({ where: { viaPlatform: true, paidAt: { gte: d30 } }, select: { amount: true, platformFee: true } }),
    () => db.paymentAccount.groupBy({ by: ["status"], _count: { _all: true } }),
    () => db.paymentAccount.findMany({ where: { status: "PENDING_REVIEW" }, orderBy: { updatedAt: "asc" }, take: 20, include: { business: { select: { id: true, name: true, legalName: true, rcNumber: true } } } }),
    () => db.referral.groupBy({ by: ["status"], _count: { _all: true } }),
    () => db.referral.count({ where: { status: "QUALIFIED", qualifiedAt: { gte: d30 } } }),
    // Referrals waiting for a check come first, then the most recent.
    () => db.referral.findMany({ orderBy: [{ status: "desc" }, { createdAt: "desc" }], where: { OR: [{ status: "REVIEW" }, { createdAt: { gte: d30 } }] }, take: 20, include: { referrer: { select: { id: true, name: true } }, referred: { select: { id: true, name: true } } } }),
    () => db.platformPayment.findMany({ where: { status: "PAID", business: { trialStartedAt: { not: null } } }, distinct: ["businessId"], select: { businessId: true } }),
  ] as const);
  const refBy = (st: string) => refStatus.find((g) => g.status === st)?._count._all ?? 0;
  const trialing = rows.filter((r) => r.trialEndsAt && r.pro && r.proUntil && r.proUntil.getTime() <= r.trialEndsAt.getTime());
  const everTrialed = rows.filter((r) => r.trialStartedAt).length;
  const platformVolume = platform30.reduce((s, p) => s + p.amount, 0);
  const platformFees = platform30.reduce((s, p) => s + p.platformFee, 0);
  const accountsBy = (st: string) => payAccounts.find((g) => g.status === st)?._count._all ?? 0;

  const total = rows.length;
  const onboarded = rows.filter((r) => r.onboardedAt).length;
  const activePro = pros.filter((b) => isPro(b, now));
  const lastPayment = new Map<string, { amount: number; months: number }>();
  for (const p of proPayments) if (!lastPayment.has(p.businessId)) lastPayment.set(p.businessId, p);
  const mrr = activePro.reduce((s, b) => { const p = lastPayment.get(b.id); return s + (p ? p.amount / Math.max(1, p.months) : 0); }, 0);
  const comped = activePro.filter((b) => !lastPayment.has(b.id)).length;
  // All money in naira: foreign-currency invoices and payments convert at their own rates.
  const online = payGroups.filter((g) => ONLINE.includes(g.method));
  const sum = (gs: typeof payGroups) => gs.reduce((s, g) => s + g.amount * g.exchangeRate, 0);
  const count = (gs: typeof payGroups) => gs.length;
  const invoiced30 = inv30.reduce((s, i) => s + i.total * i.exchangeRate, 0);
  const risky = rows.filter((r) => r.riskLevel >= 2).sort((a, b) => b.riskLevel - a.riskLevel || Number(b.pro) - Number(a.pro)).slice(0, 12);

  const weeks = Array.from({ length: 12 }, (_, i) => addDays(now, -7 * (11 - i)));
  const bucket = (dates: { createdAt: Date }[]) => weeks.map((end) => {
    const start = addDays(end, -7);
    return dates.filter((d) => d.createdAt > start && d.createdAt <= end).length;
  });
  const users = bucket(weeklyUsers);
  const invs = bucket(weeklyInvoices);
  const label = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl sm:text-3xl">Platform overview</h1>
        <p className="mt-1 text-muted">Live numbers across every business. Imported history is left out of activity figures.</p>
      </header>

      <Section title="Customers">
        <Kpi label="Businesses" value={total} hint={`${onboarded} finished setup (${pct(onboarded, total)})`} href="/admin/businesses" />
        <Kpi label="New sign-ups" value={signups7} hint={`${signups30} in the last 30 days`} />
        <Kpi label="Active this week" value={active7} hint={`${pct(active7, onboarded)} of set-up businesses`} />
        <Kpi label="At risk" value={rows.filter((r) => r.riskLevel >= 2).length} hint={`${rows.filter((r) => r.riskLevel === 3).length} need action now`} tone={rows.some((r) => r.riskLevel >= 2) ? "danger" : undefined} href="/admin/businesses?risk=1" />
      </Section>

      <Section title="Revenue">
        <Kpi label="Pro businesses" value={activePro.length} hint={`${pct(activePro.length, onboarded)} of set-up · ${comped} granted free`} tone="brand" href="/admin/businesses?plan=pro" />
        <Kpi label="MRR (est.)" value={naira(Math.round(mrr))} hint="Last payment ÷ months, active Pro only" />
        <Kpi label="Collected, 30 days" value={naira(paid30._sum.amount ?? 0)} hint={`${paid30._count._all} payments · ${nairaShort(paidAll._sum.amount ?? 0)} all time`} />
        <Kpi label="Cancelling / paused" value={`${pros.filter((b) => b.cancelAtEnd && isPro(b, now)).length} / ${pros.filter((b) => b.pausedUntil && b.pausedUntil > now).length}`} hint="Save them before renewal" />
      </Section>

      <Section title="Growth">
        <Kpi label="On a Pro trial" value={trialing.length} hint={`${everTrialed} have started a trial`} tone="brand" />
        <Kpi label="Trial → paid" value={trialPayers.length} hint={`${pct(trialPayers.length, everTrialed)} of trials have paid`} />
        <Kpi label="Referrals qualified" value={refs30} hint={`last 30 days · ${refBy("QUALIFIED")} all time`} />
        <Kpi label="Referrals pending" value={refBy("PENDING")} hint={`${refBy("REVIEW")} need review · ${refBy("REJECTED")} rejected · ${refBy("EXPIRED")} expired`} />
      </Section>

      <Section title="BizBooks Payments, last 30 days">
        <Kpi label="Paid through BizBooks" value={platform30.length} hint={`${nairaShort(platformVolume)} settled to businesses`} tone="brand" />
        <Kpi label="Fees earned" value={naira(platformFees)} hint="₦500 per payment, VAT inclusive" />
        <Kpi label="Businesses on it" value={accountsBy("ACTIVE")} hint={`${accountsBy("DISABLED")} turned off · ${accountsBy("SUSPENDED")} suspended`} />
        <Kpi label="Payout accounts to check" value={toReview.length} hint="Names that don't match the business" tone={toReview.length ? "danger" : undefined} />
      </Section>

      <Section title="Activity on the platform, last 30 days">
        <Kpi label="Invoices created" value={inv30.length} hint={`${nairaShort(invoiced30)} invoiced · ${invAll} all time`} />
        <Kpi label="Payments recorded" value={count(payGroups)} hint={`${nairaShort(sum(payGroups))} received by businesses`} />
        <Kpi label="Paid online" value={count(online)} hint={`${nairaShort(sum(online))} via their Paystack/Flutterwave`} />
        <Kpi label="Payroll runs paid" value={payroll30._count._all} hint={`${nairaShort(payroll30._sum.gross ?? 0)} gross · ${employees} people on payroll`} />
        <Kpi label="Quotes sent" value={quotes30} />
        <Kpi label="Calculator leads" value={leads30} hint={`${leadsAll} total · ${leadsConverted} signed up`} />
        <Kpi label="Imported invoices" value={imported} hint="Brought in from Wave, Zoho or CSV" />
        <Kpi label="Advisor requests open" value={advisor.length} hint="New or contacted" />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Sign-ups per week">
          <ColumnChart unit="count" height={200} caption="Sign-ups per week, last 12 weeks" rows={weeks.map((w, i) => ({ label: label(w), signups: users[i] }))} series={[{ key: "signups", label: "Sign-ups", color: VIZ.in }]} />
        </Panel>
        <Panel title="Invoices created per week">
          <ColumnChart unit="count" height={200} caption="Invoices created per week, last 12 weeks" rows={weeks.map((w, i) => ({ label: label(w), invoices: invs[i] }))} series={[{ key: "invoices", label: "Invoices", color: VIZ.net }]} />
        </Panel>
      </div>

      {toReview.length > 0 && <Panel title="Payout accounts to check"><PaymentReviews accounts={toReview} /></Panel>}

      {recentRefs.length > 0 && <Panel title="Recent referrals"><ReferralList referrals={recentRefs} /></Panel>}

      <Panel title="At risk" action={<Link href="/admin/businesses?risk=1" className="text-sm font-semibold text-brand hover:underline">See all</Link>}>
        {risky.length === 0 ? <p className="text-muted">Nobody at risk right now.</p> : (
          <ul className="divide-y divide-line">
            {risky.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/admin/businesses/${r.id}`} className="font-semibold hover:underline">{r.name}</Link>
                  <p className="text-sm text-muted">{r.owner.email}{r.owner.phone ? ` · ${r.owner.phone}` : ""} · {r.plan}</p>
                  <p className="mt-1 text-sm">{r.risks.map((x) => x.reason).join(" · ")}</p>
                </div>
                <Badge tone={r.riskLevel === 3 ? "danger" : "sun"}>{r.riskLevel === 3 ? "Act now" : "Watch"}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Advisor requests">
          {advisor.length === 0 ? <p className="text-muted">No open requests.</p> : (
            <ul className="divide-y divide-line">
              {advisor.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{a.companyName} <span className="font-normal text-muted">· {a.contactName}</span></p>
                      <p className="text-sm text-muted"><a href={`mailto:${a.email}`} className="hover:underline">{a.email}</a>{a.phone ? ` · ${a.phone}` : ""} · {timeAgo(a.createdAt)}</p>
                      <p className="text-sm">{a.services.split(",").map((s) => s.toLowerCase()).join(", ")}{a.teamSize ? ` · ${a.teamSize} staff` : ""}</p>
                      {a.message && <p className="mt-1 text-sm text-ink-soft">{a.message}</p>}
                    </div>
                    <form action={setAdvisorStatus} className="flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      {["CONTACTED", "WON", "LOST"].filter((s) => s !== a.status).map((s) => (
                        <button key={s} name="status" value={s} className="min-h-9 rounded-full border border-line-strong px-3 text-xs font-semibold hover:border-ink">{s[0] + s.slice(1).toLowerCase()}</button>
                      ))}
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Why people cancel">
          {feedback.length === 0 ? <p className="text-muted">No cancellation feedback yet.</p> : (
            <ul className="divide-y divide-line">
              {feedback.map((f) => (
                <li key={f.id} className="py-3 text-sm">
                  <p><Link href={`/admin/businesses/${f.business.id}`} className="font-semibold hover:underline">{f.business.name}</Link> <span className="text-muted">· {timeAgo(f.createdAt)}</span></p>
                  <p>{f.reason.replace(/_/g, " ").toLowerCase()}{f.details ? `: ${f.details}` : ""}</p>
                  <p className="text-muted">Outcome: {f.outcome.replace(/_/g, " ").toLowerCase()}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent admin actions">
        {actions.length === 0 ? <p className="text-muted">Nothing yet. Actions like granting Pro are logged here.</p> : (
          <ul className="divide-y divide-line text-sm">
            {actions.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{a.action.replace(/_/g, " ").toLowerCase()}</strong>{a.detail ? ` · ${a.detail}` : ""}{a.businessId && <> · <Link href={`/admin/businesses/${a.businessId}`} className="text-brand hover:underline">business</Link></>}</span>
                <span className="text-muted">{a.adminEmail} · {formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function pct(a: number, b: number) {
  return b ? `${Math.round((a / b) * 100)}%` : "0%";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function Kpi({ label, value, hint, tone, href }: { label: string; value: number | string; hint?: string; tone?: "brand" | "danger"; href?: string }) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={cn("num mt-1 text-2xl font-bold", tone === "danger" && "text-danger", tone === "brand" && "text-brand-deep")}>{typeof value === "number" ? value.toLocaleString("en-NG") : value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  return href
    ? <Link href={href} className="rounded-2xl border border-line bg-paper p-4 hover:border-ink">{body}</Link>
    : <div className="rounded-2xl border border-line bg-paper p-4">{body}</div>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-lg">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

/** Payout accounts waiting for a person to check them (name didn't match the business). */
function PaymentReviews({ accounts }: { accounts: { id: string; bankName: string; accountNumber: string; accountName: string; reviewNote: string | null; createdAt: Date; pendingBankName: string | null; pendingAccountNumber: string | null; pendingAccountName: string | null; business: { id: string; name: string; legalName: string | null; rcNumber: string | null } }[] }) {
  return (
    <ul className="divide-y divide-line">
      {accounts.map((a) => (
        <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 text-sm">
            <Link href={`/admin/businesses/${a.business.id}`} className="font-semibold hover:underline">{a.business.name}</Link>
            <span className="text-muted"> · {a.business.legalName ?? "no legal name"} · {a.business.rcNumber ? `RC/BN ${a.business.rcNumber}` : "no CAC number"}</span>
            {a.pendingAccountNumber
              ? <p>Change from {a.accountName} ({a.bankName} ••{a.accountNumber.slice(-4)}) to <strong>{a.pendingAccountName}</strong> · {a.pendingBankName} ••{a.pendingAccountNumber.slice(-4)}</p>
              : <p>Bank says: <strong>{a.accountName}</strong> · {a.bankName} ••{a.accountNumber.slice(-4)}</p>}
            {a.reviewNote && <p className="text-muted">{a.reviewNote} · {timeAgo(a.createdAt)}</p>}
          </div>
          <form action={adminReviewPaymentAccount} className="flex flex-wrap gap-1">
            <input type="hidden" name="id" value={a.id} />
            <button name="decision" value="approve" className="min-h-9 rounded-full bg-brand px-3 text-xs font-semibold text-white hover:bg-brand-deep">Approve</button>
            <button name="decision" value="reject" className="min-h-9 rounded-full border border-danger/40 px-3 text-xs font-semibold text-danger hover:bg-danger-wash">Reject</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

/** Recent referrals, with overrides for the cases the automatic rules get wrong. */
function ReferralList({ referrals }: { referrals: { id: string; status: string; reason: string | null; source: string; createdAt: Date; referrer: { id: string; name: string }; referred: { id: string; name: string } }[] }) {
  return (
    <ul className="divide-y divide-line text-sm">
      {referrals.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="min-w-0">
            <Link href={`/admin/businesses/${r.referrer.id}`} className="font-semibold hover:underline">{r.referrer.name}</Link>
            {" → "}
            <Link href={`/admin/businesses/${r.referred.id}`} className="hover:underline">{r.referred.name}</Link>
            <span className="text-muted"> · {r.source === "INVOICE" ? "invoice link" : "shared link"} · {timeAgo(r.createdAt)}{r.reason ? ` · ${r.reason}` : ""}</span>
          </span>
          <span className="flex items-center gap-1">
            <Badge tone={r.status === "QUALIFIED" ? "brand" : r.status === "REJECTED" ? "danger" : r.status === "PENDING" || r.status === "REVIEW" ? "sun" : "neutral"}>{r.status === "REVIEW" ? "needs review" : r.status.toLowerCase()}</Badge>
            {(r.status === "PENDING" || r.status === "REVIEW" || r.status === "REJECTED") && (
              <form action={adminReferralDecision} className="flex gap-1">
                <input type="hidden" name="id" value={r.id} />
                <button name="decision" value="approve" className="min-h-8 rounded-full border border-line-strong px-2.5 text-xs font-semibold hover:border-ink">Approve</button>
                {(r.status === "PENDING" || r.status === "REVIEW") && <button name="decision" value="reject" className="min-h-8 rounded-full border border-danger/40 px-2.5 text-xs font-semibold text-danger hover:bg-danger-wash">Reject</button>}
              </form>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
