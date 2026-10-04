import { TrialCard } from "@/components/trial-card";
import Link from "next/link";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleAlert, FilePlus2, FileSignature, Landmark, PartyPopper, Receipt, Repeat, UsersRound } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { receivables } from "@/lib/stats";
import { accrualSeries, accrualTotals, cashFlowSeries, monthStart, payables, type Aging } from "@/lib/finance";
import { taxObligations } from "@/lib/taxes";
import { computePay, payDateFor, periodOf } from "@/lib/payroll";
import { money, naira, nairaShort } from "@/lib/money";
import { inGracePeriod, isPro } from "@/lib/plan";
import { addDays, addMonths, cn, formatDate, timeAgo } from "@/lib/utils";
import { ButtonLink, Panel } from "@/components/ui";
import { InstallPrompt } from "@/components/pwa";
import { ColumnChart, Donut } from "@/components/charts";
import { VIZ } from "@/lib/viz";

export const metadata = { title: "Overview" };

type Upcoming = { date: Date; label: string; sub: string; amount: number; direction: "in" | "out"; href: string; urgent?: boolean };

const TILES = [
  { href: "/app/quotes/new", label: "Create quote", icon: FileSignature, cls: "bg-[#e3f2ea] hover:bg-[#d3ebdf]" },
  { href: "/app/invoices/new", label: "Create invoice", icon: FilePlus2, cls: "bg-[#e7eef8] hover:bg-[#d8e3f4]" },
  { href: "/app/expenses/new", label: "Add expense or bill", icon: Receipt, cls: "bg-[#fdf1dc] hover:bg-[#fae6c2]" },
  { href: "/app/payroll", label: "Run payroll", icon: UsersRound, cls: "bg-[#efeaf7] hover:bg-[#e4dcf2]" },
];

function Filter({ param, value, options, sp }: { param: string; value: string; options: [string, string][]; sp: Record<string, string | undefined> }) {
  return (
    <nav aria-label="Period" className="flex gap-1 rounded-full bg-canvas p-1 text-xs font-semibold">
      {options.map(([v, label]) => {
        const q = new URLSearchParams(Object.entries({ ...sp, [param]: v }).filter(([, x]) => x) as [string, string][]);
        return (
          <Link key={v} href={`/app?${q}`} scroll={false} aria-current={value === v ? "true" : undefined}
            className={cn("inline-flex min-h-8 items-center rounded-full px-3", value === v ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink")}>{label}</Link>
        );
      })}
    </nav>
  );
}

function AgingTable({ title, aging, href }: { title: string; aging: Aging; href: string }) {
  const rows: [string, number][] = [["Coming due", aging.comingDue], ["1–30 days overdue", aging.d1_30], ["31–60 days overdue", aging.d31_60], ["61–90 days overdue", aging.d61_90], ["Over 90 days overdue", aging.d90plus]];
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <dl className="num divide-y divide-line rounded-xl border border-line text-sm">
        {rows.map(([label, v], i) => (
          <div key={label} className="flex justify-between gap-3 px-3 py-2.5">
            <dt className={i === 0 ? "font-semibold text-brand" : "text-ink-soft"}>{i === 0 ? <Link href={href} className="hover:underline">{label}</Link> : label}</dt>
            <dd className={cn("font-semibold", i >= 2 && v > 0 && "text-danger")}>{naira(v)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 bg-canvas px-3 py-2.5 font-bold"><dt>Total</dt><dd>{naira(aging.total)}</dd></div>
      </dl>
    </div>
  );
}

export default async function Overview({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const cfMonths = sp.cf === "6" ? 6 : 12;
  const eb = sp.eb === "month" ? "month" : "year";
  const { user, business } = await requireBusiness();
  const id = business.id;
  const now = new Date();
  const horizon = addDays(now, 30);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const [cash, pl, owed, bills, breakdown, thisYear, lastYear, claims, team, runs, recurring, taxes, counts] = await Promise.all([
    cashFlowSeries(id, cfMonths),
    accrualSeries(id, 12),
    receivables(id),
    payables(id),
    accrualTotals(id, eb === "month" ? monthStart() : yearStart, eb === "month" ? monthStart(now, 1) : new Date(now.getFullYear() + 1, 0, 1)),
    accrualTotals(id, yearStart, new Date(now.getFullYear() + 1, 0, 1)),
    accrualTotals(id, new Date(now.getFullYear() - 1, 0, 1), yearStart),
    db.paymentClaim.findMany({ where: { status: "PENDING", invoice: { businessId: id } }, include: { invoice: { include: { customer: true } } }, orderBy: { createdAt: "desc" } }),
    db.employee.findMany({ where: { businessId: id, status: "ACTIVE" } }),
    db.payRun.findMany({ where: { businessId: id }, orderBy: { period: "desc" }, take: 2, include: { items: { where: { paidAt: null }, select: { gross: true, pensionEmployer: true } } } }),
    db.recurringExpense.findMany({ where: { businessId: id, status: "ACTIVE", nextRunAt: { lte: horizon } }, orderBy: { nextRunAt: "asc" } }),
    taxObligations(business, 2),
    Promise.all([
      db.bankAccount.count({ where: { businessId: id } }),
      // Online payments are on with either the business's own gateway or BizBooks Payments.
      Promise.all([db.gateway.count({ where: { businessId: id, enabled: true } }), db.paymentAccount.count({ where: { businessId: id, status: "ACTIVE" } })]).then(([g, a]) => g + a),
      db.invoice.count({ where: { businessId: id, sentAt: { not: null } } }),
      db.recurringExpense.count({ where: { businessId: id } }),
    ]),
  ]);
  const [banks, gateways, sent, recurringCount] = counts;

  // Next 30 days: money expected in and going out, including payroll and tax deadlines.
  const upcoming: Upcoming[] = [];
  for (const r of owed.rows) if (r.inv.dueDate <= horizon && r.late <= 0) upcoming.push({ date: r.inv.dueDate, label: r.inv.customer.name, sub: r.inv.number, amount: r.dueNgn, direction: "in", href: `/app/invoices/${r.inv.id}` });
  for (const b of bills.rows) if (b.due <= horizon && b.late <= 0) upcoming.push({ date: b.due, label: b.bill.vendor || b.bill.category, sub: "Bill", amount: b.bill.amount, direction: "out", href: `/app/expenses/${b.bill.id}` });
  if (team.length) {
    const period = runs.some((r) => r.period === periodOf(now) && r.status === "PAID") ? periodOf(addMonths(now, 1)) : periodOf(now);
    const payDate = payDateFor(period, business.payDay);
    if (payDate <= horizon) {
      const run = runs.find((r) => r.period === period);
      // Once a run exists, what's left is its unpaid people at the run's own figures (it may be partly paid);
      // before that, an estimate from the current team.
      const left = run ? run.items : team.map((e) => computePay(e));
      const cost = left.reduce((s, p) => s + p.gross + p.pensionEmployer, 0);
      const people = run ? run.items.length : team.length;
      if (people > 0) upcoming.push({ date: payDate, label: "Payroll", sub: `${people} ${people === 1 ? "person" : "people"}${run ? (run.status === "PARTIAL" ? " left to pay" : "") : " · not run yet"}`, amount: cost, direction: "out", href: run ? `/app/payroll/runs/${run.id}` : "/app/payroll" });
    }
  }
  for (const r of recurring) upcoming.push({ date: r.nextRunAt, label: r.title, sub: r.asBill ? "Recurring bill" : "Recurring", amount: r.amount, direction: "out", href: `/app/expenses/recurring/${r.id}` });
  for (const t of taxes.filter((t) => !t.filed && t.dueDate <= horizon)) upcoming.push({ date: t.dueDate, label: t.title, sub: t.dueDate < now ? "Overdue" : "Tax deadline", amount: t.amount, direction: "out", href: "/app/taxes", urgent: t.dueDate < now });
  upcoming.sort((a, b) => a.date.getTime() - b.date.getTime());
  const expectedIn = upcoming.filter((u) => u.direction === "in").reduce((s, u) => s + u.amount, 0);
  const goingOut = upcoming.filter((u) => u.direction === "out").reduce((s, u) => s + u.amount, 0);

  const overdueInvoices = owed.rows.filter((r) => r.late > 0).sort((a, b) => b.dueNgn - a.dueNgn);
  const overdueBills = bills.rows.filter((r) => r.late > 0);

  const checklist = [
    { done: banks > 0, label: "Add the company bank account", href: "/app/settings/payments" },
    { done: gateways > 0, label: "Turn on online payments", href: "/app/settings/payments" },
    { done: sent > 0, label: "Send your first invoice", href: "/app/invoices/new" },
    { done: team.length > 0, label: "Add your team to payroll", href: "/app/payroll/team/new" },
    { done: recurringCount > 0, label: "Set up rent, software and other fixed costs", href: "/app/expenses/recurring/new" },
    { done: !!business.tin, label: "Add your company TIN", href: "/app/settings" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">{greeting}, {user.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-muted">{business.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href} className={cn("flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-center text-sm font-semibold text-ink transition-colors sm:text-[0.95rem]", t.cls)}>
            <t.icon className="size-5 shrink-0" aria-hidden />{t.label}
          </Link>
        ))}
      </div>

      <TrialCard business={business} />

      {inGracePeriod(business) && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 border-sun bg-sun-wash p-4">
          <p className="text-sun-ink"><strong>Your Pro plan ended on {formatDate(business.proUntil)}.</strong> Pro features keep running for a few more days. Renew to keep them on.</p>
          <ButtonLink href="/app/settings/billing" size="sm">Renew Pro</ButtonLink>
        </Panel>
      )}

      {claims.length > 0 && (
        <Panel className="border-info/30 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg"><CircleAlert className="size-5 text-info" aria-hidden /> Confirm these transfers</h2>
          <p className="text-sm text-muted">Clients say they've paid by transfer. Confirm once you see it in your bank.</p>
          <ul className="mt-3 divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><strong>{c.invoice.customer.name}</strong> · <span className="num">{money(c.amount, c.invoice.currency)}</span> for {c.invoice.number} · <span className="text-muted">{timeAgo(c.createdAt)}</span></span>
                <ButtonLink href={`/app/invoices/${c.invoiceId}`} size="sm" variant="secondary">Review</ButtonLink>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {doneCount < checklist.length && (
        <Panel className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg">Finish setting up</h2>
            <span className="num text-sm font-semibold text-muted">{doneCount}/{checklist.length}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${(doneCount / checklist.length) * 100}%` }} /></div>
          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {checklist.map((c) => (
              <li key={c.label}>
                {c.done ? (
                  <span className="flex min-h-10 items-center gap-3 text-muted line-through"><Check className="size-5 shrink-0 rounded-full bg-brand p-0.5 text-white" aria-hidden />{c.label}</span>
                ) : (
                  <Link href={c.href} className="flex min-h-10 items-center gap-3 font-medium hover:text-brand">
                    <span className="size-5 shrink-0 rounded-full border-2 border-line-strong" aria-hidden />{c.label}<ArrowRight className="ml-auto size-4 shrink-0 text-muted" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <h2 className="pt-2 text-2xl">Insights for you</h2>

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Panel className="p-5">
          <h2 className="text-lg">Overdue invoices and bills</h2>
          <h3 className="mb-2 mt-4 flex items-center justify-between text-sm font-semibold">
            Overdue invoices ({overdueInvoices.length}){overdueInvoices.length > 0 && <Link href="/app/invoices?filter=overdue" className="text-brand hover:underline">View all</Link>}
          </h3>
          {overdueInvoices.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm"><PartyPopper className="size-4 text-brand" aria-hidden />No overdue invoices. Nice.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {overdueInvoices.slice(0, 4).map(({ inv, due, late }) => (
                <li key={inv.id}>
                  <Link href={`/app/invoices/${inv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{inv.customer.name}</span><span className="text-sm text-danger">Overdue {late} day{late === 1 ? "" : "s"} · {inv.number}</span></span>
                    <span className="num font-bold">{money(due, inv.currency)}</span>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-5 text-sm font-semibold">Overdue bills ({overdueBills.length})</h3>
          {overdueBills.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-line px-4 py-3 text-sm"><PartyPopper className="size-4 text-brand" aria-hidden />You don't have any overdue bills.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {overdueBills.slice(0, 3).map(({ bill, late }) => (
                <li key={bill.id}>
                  <Link href={`/app/expenses/${bill.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{bill.vendor || bill.category}</span><span className="text-sm text-danger">Overdue {late} days</span></span>
                    <span className="num font-bold">{naira(bill.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {!isPro(business) && overdueInvoices.length > 0 && (
            <p className="mt-4 rounded-xl bg-canvas p-3 text-sm text-ink-soft">Pro emails polite reminders before and after the due date, so you don't have to chase. <Link href="/app/settings/billing" className="font-semibold text-brand">See Pro</Link></p>
          )}
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg">Cash flow</h2><p className="text-xs text-muted">Money that actually moved (cash basis)</p></div>
            <Filter param="cf" value={String(cfMonths)} options={[["6", "6 months"], ["12", "12 months"]]} sp={sp} />
          </div>
          <ColumnChart
            caption={`Cash flow, last ${cfMonths} months`}
            rows={cash.map((r) => ({ label: r.label, inflow: r.inflow, outflow: r.outflow, net: r.net }))}
            series={[{ key: "inflow", label: "Inflow", color: VIZ.in }, { key: "outflow", label: "Outflow", color: VIZ.out }, { key: "net", label: "Net change", color: VIZ.net, kind: "line" }]}
          />
          <Link href="/app/reports/cash-flow" className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline">View report →</Link>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-lg">Next 30 days</h2>
          <p className="text-xs text-muted">Invoices due to you, bills, payroll and tax deadlines</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p className="rounded-xl bg-brand-wash p-2.5 text-brand-deep"><span className="block text-xs font-semibold">Expected in</span><span className="num text-base font-bold">{naira(Math.round(expectedIn))}</span></p>
            <p className="rounded-xl bg-sun-wash p-2.5 text-sun-ink"><span className="block text-xs font-semibold">Going out</span><span className="num text-base font-bold">{naira(Math.round(goingOut))}</span></p>
          </div>
          {upcoming.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">Nothing due in the next 30 days.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {upcoming.slice(0, 7).map((u, i) => (
                <li key={i}>
                  <Link href={u.href} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", u.direction === "in" ? "bg-brand-wash text-brand" : "bg-sun-wash text-sun-ink")}>
                      {u.direction === "in" ? <ArrowDownLeft className="size-4" aria-label="Money in" /> : u.sub.includes("Tax") || u.urgent ? <Landmark className="size-4" aria-label="Tax" /> : u.label === "Payroll" ? <UsersRound className="size-4" aria-label="Payroll" /> : u.sub.startsWith("Recurring") ? <Repeat className="size-4" aria-label="Recurring" /> : <ArrowUpRight className="size-4" aria-label="Money out" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.label}</p>
                      <p className={cn("truncate text-xs", u.urgent ? "font-semibold text-danger" : "text-muted")}>{formatDate(u.date, { day: "numeric", month: "short" })} · {u.sub}</p>
                    </div>
                    <p className="num text-sm font-bold">{u.direction === "in" ? "+" : "−"}{nairaShort(u.amount)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="text-lg">Profit and loss</h2>
          <p className="text-xs text-muted">What you earned and spent, paid or not (accrual), last 12 months</p>
          <ColumnChart
            caption="Profit and loss, last 12 months"
            rows={pl.map((r) => ({ label: r.label, income: r.income, expenses: r.expenses }))}
            series={[{ key: "income", label: "Income", color: VIZ.in }, { key: "expenses", label: "Expenses", color: VIZ.out }]}
          />
          <Link href="/app/reports/profit-and-loss" className="mt-2 inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline">View report →</Link>
        </Panel>

        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 className="text-lg">Expenses breakdown</h2>
            <Filter param="eb" value={eb} options={[["month", "This month"], ["year", "This year"]]} sp={sp} />
          </div>
          <Donut items={breakdown.categories} caption={`Expenses by category, ${eb === "month" ? "this month" : "this year"}`} />
        </Panel>

        <Panel className="p-5">
          <h2 className="text-lg">Net income</h2>
          <p className="text-xs text-muted">This year so far compared with last year (accrual)</p>
          <ColumnChart
            height={180}
            caption="Net income, last year and this year"
            rows={[{ label: String(now.getFullYear() - 1), net: lastYear.net }, { label: `${now.getFullYear()} so far`, net: thisYear.net }]}
            series={[{ key: "net", label: "Net income", color: VIZ.in }]}
          />
          <table className="num mt-3 w-full text-sm">
            <thead><tr className="border-b border-line text-right text-xs text-muted"><th className="py-2 text-left font-semibold"> </th><th className="py-2 font-semibold">{now.getFullYear() - 1}</th><th className="py-2 font-semibold">{now.getFullYear()} so far</th></tr></thead>
            <tbody>
              {([["Income", lastYear.income, thisYear.income], ["Expenses", lastYear.expenses, thisYear.expenses], ["Net income", lastYear.net, thisYear.net]] as [string, number, number][]).map(([label, a, b]) => (
                <tr key={label} className="border-b border-line last:border-0"><th scope="row" className="py-2 text-left font-medium">{label}</th><td className="py-2 text-right">{naira(a)}</td><td className="py-2 text-right font-semibold">{naira(b)}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel className="p-5">
        <h2 className="text-lg">Payable and owing</h2>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <AgingTable title="Invoices payable to you" aging={owed.aging} href="/app/invoices?filter=unpaid" />
          <AgingTable title="Bills you owe" aging={bills.aging} href="/app/expenses?filter=bills" />
        </div>
      </Panel>

      <InstallPrompt />
    </div>
  );
}
