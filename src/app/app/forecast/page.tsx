import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { cashForecast, FORECAST_WEEKS, type Flow } from "@/lib/forecast";
import { naira, nairaShort } from "@/lib/money";
import { VIZ } from "@/lib/viz";
import { cn, formatDate } from "@/lib/utils";
import { Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { CashBalanceForm } from "@/components/forecast-bits";

export const metadata = { title: "Cash flow forecast" };

const short = (d: Date) => formatDate(d, { day: "numeric", month: "short" });

function FlowList({ flows, sign }: { flows: Flow[]; sign: 1 | -1 }) {
  if (!flows.length) return <p className="text-sm text-muted">Nothing expected.</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {flows.map((f, i) => (
        <li key={i} className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            {f.href ? <Link href={f.href} className="font-medium hover:underline">{f.label}</Link> : <span className="font-medium">{f.label}</span>}
            <span className="block text-xs text-muted">{short(f.date)} · {f.sub}{f.estimate ? " · estimate" : ""}</span>
          </span>
          <span className={cn("num shrink-0 font-semibold", sign < 0 && "text-ink-soft")}>{sign < 0 ? "−" : ""}{naira(f.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function Forecast({ searchParams }: { searchParams: Promise<{ everyday?: string }> }) {
  const { business } = await requireBusiness();
  const { everyday } = await searchParams;
  const includeEveryday = everyday !== "off";
  const f = await cashForecast(business, { everyday: includeEveryday });
  const rows = f.weeks.map((w) => ({ label: short(w.start), inflow: w.in, outflow: w.out, balance: w.closing }));

  return (
    <>
      <PageHeader
        title="Cash flow forecast"
        description={`The next ${FORECAST_WEEKS} weeks, from your invoices, recurring billing, bills, payroll and tax deadlines. Clients are expected when they usually pay, not just on the due date.`}
      />

      <Panel className="mb-5 p-5">
        <CashBalanceForm current={business.cashBalance} />
        <p className="mt-2 text-xs text-muted">
          {f.hasBalance
            ? `Last updated ${formatDate(f.balanceAt)}. Update it whenever you check your bank app, or import a bank statement to keep it current.`
            : "Add up what's in your company bank accounts today. Without it, the forecast shows only the money coming in and going out."}
        </p>
      </Panel>

      {f.firstShort ? (
        <Notice tone="danger" className="mb-5" title={`Cash runs short in the week of ${short(f.firstShort.start)}`}>
          The balance is expected to reach {naira(f.firstShort.closing)} that week. Chase the invoices expected before then, ask a client for a deposit, or move a payment date.
        </Notice>
      ) : f.hasBalance ? (
        <Notice tone="brand" className="mb-5" title="No cash shortfall in the next 13 weeks">
          The lowest point is {naira(f.lowest.closing)} in the week of {short(f.lowest.start)}.
        </Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash today" value={f.hasBalance ? naira(f.opening) : "Not set"} tone="neutral" />
        <Stat label="Expected in" value={naira(f.totalIn)} tone="brand" hint="Next 13 weeks" />
        <Stat label="Expected out" value={naira(f.totalOut)} tone="sun" hint="Next 13 weeks" />
        <Stat label={f.hasBalance ? "Cash in 13 weeks" : "Net change"} value={naira(f.hasBalance ? f.closing : f.totalIn - f.totalOut)} tone={f.closing < 0 ? "danger" : "brand"} hint={f.hasBalance ? `Lowest: ${nairaShort(f.lowest.closing)}, week of ${short(f.lowest.start)}` : undefined} />
      </div>

      <Panel className="mt-5 p-5">
        <ColumnChart
          caption="Money in, money out and the expected balance, week by week"
          rows={rows}
          series={[{ key: "inflow", label: "Money in", color: VIZ.in }, { key: "outflow", label: "Money out", color: VIZ.out }, ...(f.hasBalance ? [{ key: "balance", label: "Balance", color: VIZ.net, kind: "line" as const }] : [])]}
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {f.everydayWeekly > 0 && (
            <span>
              {includeEveryday ? `Includes everyday spending of about ${naira(f.everydayWeekly)} a week (your last 3 months).` : "Everyday spending is left out."}{" "}
              <Link href={includeEveryday ? "/app/forecast?everyday=off" : "/app/forecast"} className="font-semibold text-brand hover:underline">{includeEveryday ? "Leave it out" : "Include it"}</Link>
            </span>
          )}
        </div>
      </Panel>

      <h2 className="mb-3 mt-8 text-lg">Week by week</h2>
      <div className="space-y-2">
        {f.weeks.map((w) => (
          <details key={w.start.toISOString()} className="group rounded-2xl border border-line bg-paper [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4">
              <span className="w-28 font-semibold">{short(w.start)}</span>
              <span className="num flex items-center gap-1 text-sm text-brand-deep"><ArrowDownLeft className="size-4" aria-hidden />{naira(w.in)}</span>
              <span className="num flex items-center gap-1 text-sm text-ink-soft"><ArrowUpRight className="size-4" aria-hidden />{naira(w.out)}</span>
              {f.hasBalance && (
                <span className={cn("num ml-auto font-bold", w.closing < 0 && "text-danger")}>
                  {w.closing < 0 && <AlertTriangle className="mr-1 inline size-4" aria-hidden />}{naira(w.closing)}
                </span>
              )}
              <span aria-hidden className={cn("text-xl text-muted transition-transform group-open:rotate-45", !f.hasBalance && "ml-auto")}>+</span>
            </summary>
            <div className="grid gap-5 border-t border-line p-4 sm:grid-cols-2">
              <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-brand-deep">Money in</h3><FlowList flows={w.inflows} sign={1} /></div>
              <div><h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-ink-soft">Money out</h3><FlowList flows={w.outflows} sign={-1} /></div>
            </div>
          </details>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted">
        A forecast, not a promise: it uses what&apos;s recorded in BizBooks. Log a client&apos;s promised payment date on the invoice and it moves here. VAT for the current month is added once the month ends.
      </p>
    </>
  );
}
