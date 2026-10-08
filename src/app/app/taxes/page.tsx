import Link from "next/link";
import { CalendarClock, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { obligationStatus, taxObligations } from "@/lib/taxes";
import { profitAndLoss, trailingTurnover, vatSummary } from "@/lib/reports";
import { monthStart } from "@/lib/stats";
import { naira } from "@/lib/money";
import { ENTITY_TYPES, TAX } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";
import { markTaxFiled, unmarkTaxFiled } from "@/app/actions/taxes";
import { setWhtTracking } from "@/app/actions/wht";
import { setComplianceTracking } from "@/app/actions/compliance";
import { db } from "@/lib/db";
import { Badge, buttonClass, PageHeader, Panel, Stat } from "@/components/ui";

export const metadata = { title: "Taxes" };

const STATUS = {
  overdue: { label: "Overdue", tone: "danger" as const },
  soon: { label: "Due this week", tone: "sun" as const },
  upcoming: { label: "Coming up", tone: "info" as const },
  filed: { label: "Remitted", tone: "brand" as const },
};

export default async function Taxes() {
  const { business: b } = await requireBusiness();
  const [obligations, thisMonth, vatNow, turnover] = await Promise.all([
    taxObligations(b, 3),
    profitAndLoss(b.id, monthStart(), monthStart(new Date(), 1)),
    vatSummary(b.id, monthStart(), monthStart(new Date(), 1)),
    trailingTurnover(b.id),
  ]);
  // Only offer WHT tracking to businesses whose clients actually deduct it.
  const whtThisYear = b.whtTracking ? 0 : (await db.invoice.aggregate({
    where: { businessId: b.id, kind: "INVOICE", status: "PAID", whtAmount: { gt: 0 }, paidAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    _sum: { whtAmount: true },
  }))._sum.whtAmount ?? 0;
  const open = obligations.filter((o) => !o.filed);
  const setAside = open.reduce((s, o) => s + o.amount, 0) + (b.vatRegistered ? Math.max(0, vatNow.net) : 0);
  const overdue = open.filter((o) => obligationStatus(o) === "overdue");
  const company = b.entityType === "LTD";
  const smallCo = turnover <= TAX.smallCompanyTurnover && !b.professionalServices;

  return (
    <>
      <PageHeader title="Taxes" description="What the company owes, when it's due, and how much to keep aside, worked out from your invoices, expenses and payroll." />
      <p className="-mt-3 mb-6 flex items-start gap-2 text-sm text-muted"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />Estimates to help you plan, based on the rules as of {TAX.reviewedOn}. Your accountant or tax adviser has the final word.</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat label="Keep aside for tax" value={naira(Math.round(setAside))} tone="sun" hint="Unremitted taxes + VAT building up this month" />
        <Stat label="Overdue" value={String(overdue.length)} tone={overdue.length ? "danger" : "brand"} hint={overdue.length ? "Late remittance attracts penalties and interest" : "Nothing late"} />
        <Stat label="WHT credits from clients" value={naira(Math.round(thisMonth.whtSuffered))} tone="brand" hint="This month: usable against your own tax" />
      </div>

      {b.whtTracking ? (
        <p className="mt-3 text-sm"><Link href="/app/wht" className="font-semibold text-brand hover:underline">See which WHT credits reached your TIN →</Link></p>
      ) : whtThisYear > 0 ? (
        <Panel className="mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="max-w-xl">
            <p className="font-semibold">Clients have deducted {naira(Math.round(whtThisYear))} of withholding tax this year</p>
            <p className="mt-1 text-sm text-ink-soft">It only counts against your company income tax if they remit it under your TIN. Track which credits arrived and ask for the missing ones.</p>
          </div>
          <form action={setWhtTracking}><input type="hidden" name="on" value="1" /><button className={buttonClass("secondary", "sm")}>Track WHT credits</button></form>
        </Panel>
      ) : null}

      <section aria-labelledby="calendar" className="mt-8">
        <h2 id="calendar" className="mb-3 flex items-center gap-2 text-xl"><CalendarClock className="size-5 text-brand" aria-hidden />Tax calendar</h2>
        {obligations.length === 0 ? (
          <Panel className="p-5 text-ink-soft">
            Nothing to remit yet. Taxes appear here as you {b.vatRegistered ? "get paid on VAT invoices and " : ""}run payroll.
            {!b.vatRegistered && <> You've told us you don't charge VAT. <Link href="/app/settings" className="font-semibold text-brand">Change that in Settings</Link>.</>}
          </Panel>
        ) : (
          <ul className="space-y-2">
            {obligations.map((o) => {
              const st = STATUS[obligationStatus(o)];
              return (
                <li key={`${o.kind}-${o.period}`} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-paper p-4", st.tone === "danger" ? "border-danger/40" : "border-line")}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{o.title} <Badge tone={st.tone}>{st.label}</Badge></p>
                    <p className="text-sm text-muted">{o.filed ? `Remitted ${formatDate(o.filedAt)}` : `Due ${formatDate(o.dueDate)}`} · {o.who}</p>
                    {o.kind === "VAT" && <Link href={`/app/taxes/vat?month=${o.period}`} className="text-sm font-semibold text-brand hover:underline">Prepare the return →</Link>}
                  </div>
                  <p className="num text-lg font-bold">{naira(o.amount)}</p>
                  <form action={o.filed ? unmarkTaxFiled : markTaxFiled}>
                    <input type="hidden" name="kind" value={o.kind} />
                    <input type="hidden" name="period" value={o.period} />
                    <input type="hidden" name="amount" value={o.amount} />
                    <button className={buttonClass(o.filed ? "ghost" : "secondary", "sm")}>{o.filed ? "Undo" : "Mark as remitted"}</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="explain" className="mt-10">
        <h2 id="explain" className="mb-3 text-xl">Your taxes, explained</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="p-5">
            <div className="flex items-center justify-between gap-2"><h3 className="text-base">VAT (7.5%)</h3><Badge tone={b.vatRegistered ? "info" : "neutral"}>{b.vatRegistered ? "You charge VAT" : "Not charging VAT"}</Badge></div>
            {b.vatRegistered ? (
              <>
                <dl className="num mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><dt>Charged on invoices this month</dt><dd className="font-semibold">{naira(vatNow.output)}</dd></div>
                  <div className="flex justify-between"><dt>Paid on expenses this month</dt><dd className="font-semibold">−{naira(vatNow.input)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-semibold">Building up to remit</dt><dd className="font-bold">{naira(Math.max(0, vatNow.net))}</dd></div>
                </dl>
                <p className="mt-3 text-sm text-ink-soft">VAT is due on invoices when you issue them, even before the client pays, and is filed monthly by the 21st. It's the government's money, so keep it separate.</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Companies above the small-company limit, and most companies whose clients are large organisations, need to register for VAT. If you have a TIN and your clients ask for VAT invoices, switch it on in Settings.</p>
            )}
          </Panel>

          <Panel className="p-5">
            <h3 className="text-base">Withholding tax (WHT)</h3>
            <p className="mt-3 text-sm text-ink-soft">
              <strong>When clients pay you:</strong> companies and government agencies usually deduct WHT before paying (5% on consultancy and professional fees, 2% on supply contracts). That isn't lost money. It's a credit in your name. Collect a <strong>WHT credit note</strong> for every deduction and give them to your accountant.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              <strong>When you pay contractors:</strong> you deduct WHT and remit it by the 21st of the next month. Payroll does this for contractors automatically.
            </p>
          </Panel>

          <Panel className="p-5">
            <h3 className="text-base">PAYE and pension</h3>
            <p className="mt-3 text-sm text-ink-soft">
              PAYE is deducted from staff salaries and paid to the state where each employee lives, by the 10th of the next month. Pension (8% from staff + 10% from you) goes to each person's PFA within 7 working days of pay day. <Link href="/app/payroll" className="font-semibold text-brand">Payroll</Link> works both out for you.
            </p>
          </Panel>

          <Panel className="p-5">
            <h3 className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-brand" aria-hidden />Company income tax</h3>
            {company ? (
              <>
                <p className="mt-3 text-sm text-ink-soft">Sales over the last 12 months: <strong className="num text-ink">{naira(turnover)}</strong></p>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-canvas" role="img" aria-label={`${Math.min(100, Math.round((turnover / TAX.smallCompanyTurnover) * 100))}% of the small company limit`}>
                  <div className={cn("h-full rounded-full", turnover <= TAX.smallCompanyTurnover ? "bg-brand" : "bg-sun")} style={{ width: `${Math.min(100, (turnover / TAX.smallCompanyTurnover) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">Small company limit: {naira(TAX.smallCompanyTurnover)} a year</p>
                <p className="mt-3 text-sm text-ink-soft">
                  {b.professionalServices
                    ? <>You've told us you provide professional services, so the small-company exemption doesn't apply. Plan for company income tax of up to {TAX.standardCitRate}% of profit, and keep your expense records complete, because every naira of genuine expense reduces the bill.</>
                    : smallCo
                      ? <>Based on your recorded sales you look like a <strong>small company</strong>: 0% company income tax, as long as your fixed assets are under {naira(TAX.smallCompanyFixedAssets)}. You still file a return each year, within 6 months of your year end.</>
                      : <>Your sales are above the small-company limit, so company income tax (up to {TAX.standardCitRate}% of profit) is likely to apply. Your profit report is the starting point for your accountant.</>}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">As a {ENTITY_TYPES[b.entityType]?.toLowerCase() ?? "business"}, profit is taxed through the owner's personal income tax, not company income tax. The same records apply.</p>
            )}
          </Panel>
        </div>
      </section>

      {!b.complianceTracking && (
        <Panel className="mt-8 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="max-w-xl">
            <p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-brand" aria-hidden />Selling to big companies or government?</p>
            <p className="mt-1 text-sm text-ink-soft">Keep your CAC, tax clearance and other certificates in one place, get warned before they expire, and send a one-PDF vendor pack with any tender.</p>
          </div>
          <form action={setComplianceTracking}><input type="hidden" name="on" value="1" /><button className={buttonClass("secondary", "sm")}>Set up compliance</button></form>
        </Panel>
      )}

      <p className="mt-8 flex items-center gap-2 text-sm text-muted"><CheckCircle2 className="size-4 text-brand" aria-hidden />Tip: give your accountant access to the monthly CSV from <Link href="/app/reports" className="font-semibold text-brand">Reports</Link> and filing becomes a short job.</p>
    </>
  );
}
