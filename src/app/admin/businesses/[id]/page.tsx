import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { inSequence, planLabel, risksFor } from "@/lib/admin";
import { addNote, clearCancel, endPause, grantPro, revokePro } from "@/app/actions/admin";
import { adminReviewPaymentAccount } from "@/app/actions/payments";
import { Badge } from "@/components/ui";
import { isPro } from "@/lib/plan";
import { money, naira, nairaShort } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const b = await db.business.findUnique({ where: { id: (await params).id }, select: { name: true } });
  return { title: b?.name ?? "Business" };
}

export default async function AdminBusiness({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await db.business.findUnique({
    where: { id },
    include: { owner: { select: { email: true, fullName: true, phone: true, createdAt: true, termsAcceptedAt: true } }, gateways: { select: { provider: true, enabled: true } }, bankAccounts: { select: { id: true } }, paymentAccount: true },
  });
  if (!b) notFound();
  const now = new Date();
  const [customers, employees, expenses, payRuns, sent, invoiced, paid, recent, subs, feedback, log, schedules, platformPays] = await inSequence([
    () => db.customer.count({ where: { businessId: id } }),
    () => db.employee.count({ where: { businessId: id } }),
    () => db.expense.count({ where: { businessId: id } }),
    () => db.payRun.count({ where: { businessId: id, status: "PAID" } }),
    () => db.invoice.count({ where: { businessId: id, sentAt: { not: null }, importSource: null } }),
    () => db.invoice.findMany({ where: { businessId: id, kind: "INVOICE", status: { not: "VOID" } }, select: { total: true, exchangeRate: true } }),
    () => db.payment.findMany({ where: { businessId: id }, select: { amount: true, exchangeRate: true } }),
    () => db.invoice.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { name: true } } } }),
    () => db.platformPayment.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
    () => db.cancellationFeedback.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" } }),
    () => db.adminAction.findMany({ where: { businessId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    () => db.recurringSchedule.count({ where: { businessId: id, status: "ACTIVE" } }),
    () => db.payment.findMany({ where: { businessId: id, viaPlatform: true }, select: { amount: true, platformFee: true } }),
  ] as const);
  const risks = risksFor(b, sent, now);
  const pro = isPro(b, now);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="text-sm font-semibold text-muted hover:text-ink">← Businesses</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl">{b.name}</h1>
          <Badge tone={pro ? "brand" : "neutral"}>{planLabel(b, now)}</Badge>
        </div>
        <p className="mt-1 text-muted">
          {b.owner.fullName} · <a href={`mailto:${b.owner.email}`} className="hover:underline">{b.owner.email}</a>{b.owner.phone ? ` · ${b.owner.phone}` : ""}
          {" · "}{[b.legalName, b.entityType, b.rcNumber && `RC ${b.rcNumber}`, b.industry, b.teamSize && `${b.teamSize} staff`, b.state].filter(Boolean).join(" · ")}
        </p>
        <p className="text-sm text-muted">Joined {formatDate(b.owner.createdAt)} · setup {b.onboardedAt ? `finished ${formatDate(b.onboardedAt)}` : "not finished"} · last active {timeAgo(b.lastActiveAt)} · terms accepted {b.owner.termsAcceptedAt ? formatDate(b.owner.termsAcceptedAt) : "—"}</p>
      </div>

      {risks.length > 0 && (
        <div className="rounded-2xl border border-danger/30 bg-danger-wash p-4">
          <p className="font-semibold text-danger">Risk signals</p>
          <ul className="mt-1 list-disc pl-5 text-sm">{risks.map((r) => <li key={r.reason}>{r.reason}</li>)}</ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Fact label="Invoices" value={String(invoiced.length)} hint={`${nairaShort(invoiced.reduce((s, i) => s + i.total * i.exchangeRate, 0))} · ${sent} sent from BizBooks`} />
        <Fact label="Payments recorded" value={String(paid.length)} hint={nairaShort(paid.reduce((s, p) => s + p.amount * p.exchangeRate, 0))} />
        <Fact label="Clients" value={String(customers)} hint={`${schedules} active recurring invoices`} />
        <Fact label="Payroll" value={String(employees)} hint={`${payRuns} runs paid · ${expenses} expenses`} />
        <Fact label="Getting paid" value={b.gateways.filter((g) => g.enabled).map((g) => g.provider[0] + g.provider.slice(1).toLowerCase()).join(", ") || "Bank only"} hint={`${b.bankAccounts.length} bank account${b.bankAccounts.length === 1 ? "" : "s"}`} />
        <Fact label="VAT" value={b.vatRegistered ? "Registered" : "No"} hint={b.professionalServices ? "Professional services" : undefined} />
      </div>

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-lg">Plan</h2>
        <p className="mt-1 text-sm text-muted">
          {b.plan === "PRO" && b.proUntil ? `Pro paid to ${formatDate(b.proUntil)}.` : "On the Free plan."}
          {b.cancelAtEnd && " Set to cancel at the end of the period."}
          {b.pausedUntil && b.pausedUntil > now && ` Paused until ${formatDate(b.pausedUntil)}.`}
          {b.discountPercent > 0 && b.discountUntil && b.discountUntil > now && ` ${b.discountPercent}% discount until ${formatDate(b.discountUntil)}.`}
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <form action={grantPro} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={b.id} />
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Grant Pro</span>
              <select name="months" defaultValue="1" className="min-h-11 rounded-xl border border-line-strong bg-paper px-3">
                {[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} month{m === 1 ? "" : "s"}</option>)}
              </select>
            </label>
            <input name="note" placeholder="Reason (logged)" className="min-h-11 rounded-xl border border-line-strong bg-paper px-3 text-sm" />
            <button className="min-h-11 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep">{pro ? "Add time" : "Grant Pro"}</button>
          </form>
          {b.cancelAtEnd && <form action={clearCancel}><input type="hidden" name="id" value={b.id} /><button className="min-h-11 rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-ink">Undo cancellation</button></form>}
          {b.pausedUntil && b.pausedUntil > now && <form action={endPause}><input type="hidden" name="id" value={b.id} /><button className="min-h-11 rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-ink">End pause</button></form>}
          {b.plan === "PRO" && (
            <form action={revokePro} className="flex gap-2">
              <input type="hidden" name="id" value={b.id} />
              <input type="hidden" name="note" value="Revoked from admin" />
              <button className="min-h-11 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger-wash">Move to Free</button>
            </form>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Granted time is added on top of any time already paid. Every change is logged below.</p>
      </section>

      {b.paymentAccount && (
        <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg">BizBooks Payments</h2>
            <Badge tone={b.paymentAccount.status === "ACTIVE" ? "brand" : b.paymentAccount.status === "PENDING_REVIEW" ? "sun" : b.paymentAccount.status === "SUSPENDED" ? "danger" : "neutral"}>{b.paymentAccount.status.replace("_", " ").toLowerCase()}</Badge>
          </div>
          <p className="mt-1 text-sm">
            Settles to <strong>{b.paymentAccount.accountName}</strong> · {b.paymentAccount.bankName} ••{b.paymentAccount.accountNumber.slice(-4)}
            {b.paymentAccount.subaccountCode && <span className="text-muted"> · {b.paymentAccount.subaccountCode}</span>}
          </p>
          <p className="text-sm text-muted">
            {platformPays.length} payments · {nairaShort(platformPays.reduce((s, p) => s + p.amount, 0))} settled · {naira(platformPays.reduce((s, p) => s + p.platformFee, 0))} fees earned · {b.paymentAccount.feeFreeLeft} fee-free left
          </p>
          {b.paymentAccount.reviewNote && <p className="mt-1 text-sm text-sun-ink">{b.paymentAccount.reviewNote}</p>}
          <form action={adminReviewPaymentAccount} className="mt-3 flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={b.paymentAccount.id} />
            {b.paymentAccount.status !== "ACTIVE" && <button name="decision" value="approve" className="min-h-10 rounded-full bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep">Approve / reactivate</button>}
            {b.paymentAccount.status === "PENDING_REVIEW" && <button name="decision" value="reject" className="min-h-10 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger-wash">Reject</button>}
            {b.paymentAccount.status === "ACTIVE" && <button name="decision" value="suspend" className="min-h-10 rounded-full border border-danger/40 px-4 text-sm font-semibold text-danger hover:bg-danger-wash">Suspend</button>}
            <input name="count" inputMode="numeric" defaultValue="5" aria-label="Fee-free payments to add" className="min-h-10 w-16 rounded-xl border border-line-strong bg-paper px-2 text-sm" />
            <button name="decision" value="credits" className="min-h-10 rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-ink">Add fee-free payments</button>
            <input name="note" placeholder="Reason (for reject/suspend, emailed)" className="min-h-10 min-w-56 flex-1 rounded-xl border border-line-strong bg-paper px-3 text-sm" />
          </form>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg">Recent invoices and quotes</h2>
          {recent.length === 0 ? <p className="mt-2 text-muted">None yet.</p> : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {recent.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2">
                  <span>{i.kind === "QUOTE" ? "Quote" : "Invoice"} {i.number} · {i.customer.name}{i.importSource ? <span className="text-muted"> · imported</span> : null}</span>
                  <span className="num whitespace-nowrap">{money(i.total, i.currency)} <span className="text-muted">· {i.status.toLowerCase()}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
          <h2 className="text-lg">Subscription payments</h2>
          {subs.length === 0 ? <p className="mt-2 text-muted">No payments to BizBooks yet.</p> : (
            <ul className="mt-2 divide-y divide-line text-sm">
              {subs.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2">
                  <span>{formatDate(p.paidAt ?? p.createdAt)} · {p.months} month{p.months === 1 ? "" : "s"}</span>
                  <span className="num">{naira(p.amount)} <span className="text-muted">· {p.status.toLowerCase()}</span></span>
                </li>
              ))}
            </ul>
          )}
          {feedback.length > 0 && (
            <>
              <h3 className="mt-4 font-semibold">Cancellation feedback</h3>
              <ul className="mt-1 space-y-1 text-sm">{feedback.map((f) => <li key={f.id}>{formatDate(f.createdAt)}: {f.reason.replace(/_/g, " ").toLowerCase()}{f.details ? `, "${f.details}"` : ""} → {f.outcome.replace(/_/g, " ").toLowerCase()}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-line bg-paper p-4 sm:p-5">
        <h2 className="text-lg">Notes and history</h2>
        <form action={addNote} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="id" value={b.id} />
          <input name="note" required maxLength={1000} placeholder="e.g. Called the owner; will renew after month-end" className="min-h-11 flex-1 rounded-xl border border-line-strong bg-paper px-3 text-sm" />
          <button className="min-h-11 rounded-full border border-line-strong px-4 text-sm font-semibold hover:border-ink">Add note</button>
        </form>
        {log.length === 0 ? <p className="mt-3 text-sm text-muted">No admin actions yet.</p> : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {log.map((a) => (
              <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><strong>{a.action.replace(/_/g, " ").toLowerCase()}</strong>{a.detail ? ` · ${a.detail}` : ""}</span>
                <span className="text-muted">{a.adminEmail} · {formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}
