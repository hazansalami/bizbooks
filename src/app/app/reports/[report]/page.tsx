import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { cashFlowDetail, PERIODS, periodRange, previousRange, profitAndLossDetail, vatSummary, type DetailLine, type Period } from "@/lib/reports";
import { agingOf, cashDate, paidExpensesWhere, payables, type Aging } from "@/lib/finance";
import { receivables } from "@/lib/stats";
import { naira, round2, money } from "@/lib/money";
import { periodLabel } from "@/lib/payroll";
import { PAYMENT_METHODS } from "@/lib/constants";
import { cn, daysBetween, formatDate } from "@/lib/utils";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { PrintButton } from "@/components/form-bits";
import { REPORT_TITLES, type ReportSlug } from "../catalog";

type Props = { params: Promise<{ report: string }>; searchParams: Promise<{ period?: string; basis?: string }> };

const LIVE: ReportSlug[] = ["profit-and-loss", "cash-flow", "vat", "income-by-client", "aged-receivables", "client-deposits", "purchases-by-supplier", "aged-payables", "payroll-summary", "transactions"];
const NO_PERIOD: ReportSlug[] = ["aged-receivables", "aged-payables", "client-deposits"];

export async function generateMetadata({ params }: Props) {
  const { report } = await params;
  return { title: REPORT_TITLES[report as ReportSlug] ?? "Report" };
}

function PeriodNav({ slug, period, basis }: { slug: string; period: Period; basis?: string }) {
  return (
    <nav aria-label="Report period" className="no-print no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0">
      {(Object.entries(PERIODS) as [Period, string][]).map(([key, label]) => (
        <Link key={key} href={`/app/reports/${slug}?period=${key}${basis ? `&basis=${basis}` : ""}`} aria-current={period === key ? "page" : undefined}
          className={cn("inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold", period === key ? "bg-ink text-white" : "bg-paper text-ink-soft ring-1 ring-line hover:ring-ink")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Table({ head, rows, foot, align = [] }: { head: string[]; rows: (string | number | React.ReactNode)[][]; foot?: (string | number)[]; align?: ("l" | "r")[] }) {
  const a = (i: number) => (align[i] ?? (i === 0 ? "l" : "r")) === "r" ? "text-right" : "text-left";
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
      <table className="num w-full min-w-[32rem] text-sm">
        <thead className="bg-canvas text-xs uppercase tracking-wider text-muted"><tr>{head.map((h, i) => <th key={h + i} scope="col" className={cn("p-3 font-semibold", a(i))}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="p-6 text-center text-muted">Nothing for this period.</td></tr> :
            rows.map((r, i) => <tr key={i} className="border-t border-line">{r.map((c, j) => <td key={j} className={cn("p-3", a(j))}>{c}</td>)}</tr>)}
        </tbody>
        {foot && <tfoot className="border-t-2 border-line font-bold"><tr>{foot.map((c, j) => <td key={j} className={cn("p-3", a(j))}>{c}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

/** An amount that reduces the total, shown with a minus sign (but never "−₦0"). */
const minus = (n: number) => (n ? `−${naira(n)}` : naira(0));

const agingHead = ["Coming due", "1–30 days", "31–60 days", "61–90 days", "90+ days", "Total"];
const agingCells = (a: Aging) => [a.comingDue, a.d1_30, a.d31_60, a.d61_90, a.d90plus, a.total].map((v) => naira(round2(v)));

type StatementBusiness = { name: string; legalName: string | null; rcNumber: string | null; tin: string | null; address: string | null; city: string | null; state: string | null; email: string | null; phone: string | null; logo: string | null };

/** The top of a shareable statement: who it's for, what it covers, and when it was prepared. */
function StatementHeader({ b, title, range, note }: { b: StatementBusiness; title: string; range: string; note?: string }) {
  const place = [b.address, b.city, b.state].filter(Boolean).join(", ");
  const ids = [b.rcNumber && `RC ${b.rcNumber}`, b.tin && `TIN ${b.tin}`].filter(Boolean).join(" · ");
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {b.logo && <img src={b.logo} alt="" className="max-h-12 max-w-32 object-contain" />}
        <div>
          <p className="text-lg font-bold">{b.legalName || b.name}</p>
          {ids && <p className="text-sm text-muted">{ids}</p>}
          {place && <p className="text-sm text-muted">{place}</p>}
          {(b.email || b.phone) && <p className="text-sm text-muted">{[b.email, b.phone].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
      <div className="sm:text-right">
        <p className="text-xl font-bold">{title}</p>
        <p className="text-sm text-ink-soft">{range}</p>
        {note && <p className="text-sm text-muted">{note}</p>}
        <p className="text-xs text-muted">Prepared {formatDate(new Date())}</p>
      </div>
    </header>
  );
}

/** A heading with its transactions and a subtotal: one block of a statement. */
function StatementSection({ title, lines, total, totalLabel, sign = 1, empty = "None in this period." }: { title: string; lines: DetailLine[]; total: number; totalLabel: string; sign?: 1 | -1; empty?: string }) {
  const fmt = (n: number) => (sign < 0 ? minus(n) : naira(n));
  return (
    <section className="mt-6">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-soft">{title}</h3>
      <div className="overflow-x-auto">
        <table className="num w-full min-w-[30rem] text-sm">
          <thead className="text-xs text-muted">
            <tr className="border-b border-line"><th scope="col" className="w-28 py-2 text-left font-semibold">Date</th><th scope="col" className="py-2 text-left font-semibold">Name</th><th scope="col" className="py-2 text-left font-semibold">Details</th><th scope="col" className="py-2 text-right font-semibold">Amount</th></tr>
          </thead>
          <tbody>
            {lines.length === 0 ? <tr><td colSpan={4} className="py-3 text-muted">{empty}</td></tr> : lines.map((l) => (
              <tr key={l.id} className="border-b border-line/60">
                <td className="whitespace-nowrap py-2 align-top">{formatDate(l.date)}</td>
                <td className="py-2 pr-3 align-top">{l.name}</td>
                <td className="py-2 pr-3 align-top text-ink-soft"><Link href={l.href} className="hover:underline">{l.ref || "—"}</Link></td>
                <td className="whitespace-nowrap py-2 text-right align-top">{fmt(l.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} className="py-2 font-semibold">{totalLabel}</td><td className="whitespace-nowrap py-2 text-right font-bold">{fmt(total)}</td></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

export default async function Report({ params, searchParams }: Props) {
  const { business } = await requireBusiness();
  const { report } = await params;
  const slug = report as ReportSlug;
  if (!LIVE.includes(slug)) notFound();
  const sp = await searchParams;
  const period: Period = sp.period && sp.period in PERIODS ? (sp.period as Period) : slug === "payroll-summary" ? "this-year" : "this-month";
  const { from, to } = periodRange(period);
  const id = business.id;
  const range = `${formatDate(from)} – ${formatDate(new Date(to.getTime() - 1))}`;

  let body: React.ReactNode = null;
  // Reports written as a statement (a document to share) set this, and wrap their body in sheet().
  let statement: { title: string; note?: string } | null = null;
  const sheet = (children: React.ReactNode) => (
    <article className="print-sheet rounded-2xl border border-line bg-paper p-5 sm:p-8">
      <StatementHeader b={business} title={statement?.title ?? REPORT_TITLES[slug]} range={range} note={statement?.note} />
      {children}
    </article>
  );

  if (slug === "profit-and-loss") {
    const basis = sp.basis === "cash" ? "cash" : "accrual";
    const prev = previousRange(period);
    const [cur, before] = await Promise.all([profitAndLossDetail(id, from, to, basis), profitAndLossDetail(id, prev.from, prev.to, basis)]);
    const prevLabel = prev.label.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase());
    const prevCat = new Map(before.categories.map((c) => [c.name, c.amount]));
    statement = { title: "Profit and loss statement", note: basis === "accrual" ? "Accrual basis · amounts exclude VAT" : "Cash basis · amounts exclude VAT" };
    body = (
      <>
        <nav aria-label="Basis" className="no-print mb-4 flex gap-1 rounded-full bg-paper p-1 text-sm font-semibold ring-1 ring-line sm:w-fit">
          {[["accrual", "Accrual (invoiced)"], ["cash", "Cash (paid)"]].map(([b, l]) => (
            <Link key={b} href={`/app/reports/profit-and-loss?period=${period}&basis=${b}`} aria-current={basis === b ? "true" : undefined} className={cn("inline-flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-full px-4", basis === b ? "bg-ink text-white" : "text-muted")}>{l}</Link>
          ))}
        </nav>
        {sheet(<>
          <section className="mt-5">
            <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-soft">Summary</h3>
            <table className="num w-full text-sm">
              <thead className="text-xs text-muted"><tr className="border-b border-line"><th scope="col" className="py-2 text-left font-semibold"><span className="sr-only">Line</span></th><th scope="col" className="py-2 text-right font-semibold">This period</th><th scope="col" className="py-2 text-right font-semibold">{prevLabel}</th></tr></thead>
              <tbody>
                <tr className="border-b border-line/60"><td className="py-2">Income</td><td className="py-2 text-right">{naira(cur.income.amount)}</td><td className="py-2 text-right text-ink-soft">{naira(before.income.amount)}</td></tr>
                {cur.categories.map((c) => (
                  <tr key={c.name} className="border-b border-line/60"><td className="py-2 pl-4 text-ink-soft">{c.name}</td><td className="py-2 text-right">{minus(c.amount)}</td><td className="py-2 text-right text-ink-soft">{prevCat.has(c.name) ? minus(prevCat.get(c.name)!) : "—"}</td></tr>
                ))}
                <tr className="border-b border-line/60"><td className="py-2">Total expenses</td><td className="py-2 text-right">{minus(cur.expenses)}</td><td className="py-2 text-right text-ink-soft">{minus(before.expenses)}</td></tr>
              </tbody>
              <tfoot><tr className="text-base"><td className="py-3 font-bold">{cur.net >= 0 ? "Net profit" : "Net loss"}</td><td className={cn("py-3 text-right font-bold", cur.net < 0 && "text-danger")}>{naira(cur.net)}</td><td className="py-3 text-right font-semibold text-ink-soft">{naira(before.net)}</td></tr></tfoot>
            </table>
          </section>

          <StatementSection title={basis === "accrual" ? "Income: invoices issued" : "Income: payments received"} lines={cur.income.lines} total={cur.income.amount} totalLabel="Total income" />
          {cur.categories.map((c) => <StatementSection key={c.name} title={`Expenses: ${c.name}`} lines={c.lines} total={c.amount} totalLabel={`Total ${c.name.toLowerCase()}`} sign={-1} />)}
          {cur.categories.length === 0 && <StatementSection title="Expenses" lines={[]} total={0} totalLabel="Total expenses" sign={-1} />}

          <table className="num mt-6 w-full border-t-2 border-ink text-base">
            <tbody>
              <tr><td className="py-2">Total income</td><td className="py-2 text-right">{naira(cur.income.amount)}</td></tr>
              <tr><td className="py-2">Total expenses</td><td className="py-2 text-right">{minus(cur.expenses)}</td></tr>
              <tr className="border-t border-line"><td className="py-3 font-bold">{cur.net >= 0 ? "Net profit" : "Net loss"}</td><td className={cn("py-3 text-right text-lg font-bold", cur.net < 0 && "text-danger")}>{naira(cur.net)}</td></tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-muted">
            {basis === "accrual" ? "Accrual basis: income when invoiced, expenses and bills on their own dates, paid or not." : "Cash basis: income when clients paid, expenses when money left the account."} All amounts are in naira and before VAT; foreign-currency amounts are converted at the rate recorded on the invoice or payment.
          </p>
        </>)}
      </>
    );
  }

  if (slug === "cash-flow") {
    const months = await cashFlowDetail(id, from, to);
    const t = months.reduce((acc, m) => ({ inflow: acc.inflow + m.totals.inflow, outflow: acc.outflow + m.totals.outflow, payroll: acc.payroll + m.totals.payroll }), { inflow: 0, outflow: 0, payroll: 0 });
    const netOf = (v: { inflow: number; outflow: number; payroll: number }) => round2(v.inflow - v.outflow - v.payroll);
    statement = { title: "Cash flow statement", note: "Money received and paid out, in naira" };
    body = sheet(<>
      <section className="mt-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-soft">Summary</h3>
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[30rem] text-sm">
            <thead className="text-xs text-muted"><tr className="border-b border-line">{["Month", "Received", "Expenses & bills", "Payroll", "Net change"].map((h, i) => <th key={h} scope="col" className={cn("py-2 font-semibold", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
            <tbody>
              {months.length === 0 ? <tr><td colSpan={5} className="py-3 text-muted">No money in or out in this period.</td></tr> : months.map((m) => (
                <tr key={m.key} className="border-b border-line/60"><td className="py-2">{periodLabel(m.key)}</td><td className="py-2 text-right">{naira(m.totals.inflow)}</td><td className="py-2 text-right">{minus(m.totals.outflow)}</td><td className="py-2 text-right">{minus(m.totals.payroll)}</td><td className={cn("py-2 text-right", netOf(m.totals) < 0 && "text-danger")}>{naira(netOf(m.totals))}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="text-base"><td className="py-3 font-bold">Total</td><td className="py-3 text-right font-semibold">{naira(round2(t.inflow))}</td><td className="py-3 text-right font-semibold">{minus(round2(t.outflow))}</td><td className="py-3 text-right font-semibold">{minus(round2(t.payroll))}</td><td className={cn("py-3 text-right font-bold", netOf(t) < 0 && "text-danger")}>{naira(netOf(t))}</td></tr></tfoot>
          </table>
        </div>
      </section>

      {months.map((m) => (
        <div key={m.key} className="mt-8 border-t border-line pt-3">
          <h2 className="text-lg font-bold">{periodLabel(m.key)}</h2>
          <StatementSection title="Money in: received from clients" lines={m.inflow} total={m.totals.inflow} totalLabel="Total received" />
          <StatementSection title="Money out: expenses and bills paid" lines={m.outflow} total={m.totals.outflow} totalLabel="Total expenses and bills" sign={-1} />
          {m.payroll.length > 0 && <StatementSection title="Money out: payroll" lines={m.payroll} total={m.totals.payroll} totalLabel="Total payroll" sign={-1} />}
          <p className="num mt-3 flex justify-between border-t border-line pt-2 font-bold"><span>Net change for {periodLabel(m.key)}</span><span className={netOf(m.totals) < 0 ? "text-danger" : ""}>{naira(netOf(m.totals))}</span></p>
        </div>
      ))}
      <p className="mt-6 text-xs text-muted">Amounts are as they moved through the bank, VAT included. Foreign-currency payments are converted to naira at the rate recorded on the day they were received.</p>
    </>);
  }

  if (slug === "vat") {
    const v = await vatSummary(id, from, to);
    body = (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[["VAT charged on invoices", v.output], ["VAT paid on expenses", v.input], [v.net >= 0 ? "Balance to pay" : "Balance to carry forward", Math.abs(v.net)]].map(([l, n], i) => (
            <Panel key={l as string} className={cn("p-4", i === 2 && "border-brand")}><p className="text-sm text-muted">{l as string}</p><p className="num text-2xl font-bold">{naira(n as number)}</p></Panel>
          ))}
        </div>
        <h2 className="text-lg">VAT on sales</h2>
        <Table head={["Date", "Invoice", "Client", "Client TIN", "Net amount", "VAT"]} align={["l", "l", "l", "l", "r", "r"]}
          rows={v.invoices.map((i) => [formatDate(i.issueDate), i.number, i.customer.name, i.customer.tin ?? "—", `${naira(i.netNgn)}${i.currency !== "NGN" ? ` (${i.currency})` : ""}`, naira(i.vatNgn)])}
          foot={["Total", "", "", "", naira(round2(v.invoices.reduce((s, i) => s + i.netNgn, 0))), naira(v.output)]} />
        <h2 className="text-lg">VAT on purchases</h2>
        <Table head={["Date", "Supplier", "Category", "Amount", "VAT"]} align={["l", "l", "l", "r", "r"]}
          rows={v.expenses.map((e) => [formatDate(e.date), e.vendor ?? "—", e.category, naira(e.amount), naira(e.vatAmount)])}
          foot={["Total", "", "", naira(round2(v.expenses.reduce((s, e) => s + e.amount, 0))), naira(v.input)]} />
        {!business.vatRegistered && <p className="text-sm text-muted">You've set the company as not VAT registered, so new invoices don't add VAT.</p>}
      </div>
    );
  }

  if (slug === "income-by-client") {
    const [invoices, payments] = await Promise.all([
      db.invoice.findMany({ where: { businessId: id, kind: "INVOICE", status: { notIn: ["DRAFT", "VOID"] }, issueDate: { gte: from, lt: to } }, include: { customer: true } }),
      db.payment.findMany({ where: { businessId: id, paidAt: { gte: from, lt: to }, invoiceId: { not: null } }, include: { invoice: { include: { customer: true } } } }),
    ]);
    const owed = await receivables(id);
    const m = new Map<string, { name: string; invoiced: number; paid: number; owed: number }>();
    const get = (cid: string, name: string) => m.get(cid) ?? m.set(cid, { name, invoiced: 0, paid: 0, owed: 0 }).get(cid)!;
    for (const i of invoices) get(i.customerId, i.customer.name).invoiced += i.total * i.exchangeRate;
    for (const p of payments) if (p.invoice) get(p.invoice.customerId, p.invoice.customer.name).paid += p.amount * p.exchangeRate;
    for (const r of owed.rows) get(r.inv.customerId, r.inv.customer.name).owed += r.dueNgn;
    const rows = [...m.values()].sort((a, b) => b.invoiced - a.invoiced);
    const sum = (k: "invoiced" | "paid" | "owed") => naira(round2(rows.reduce((s, r) => s + r[k], 0)));
    body = (
      <>
        <Table head={["Client", "Invoiced this period", "Paid this period", "Owes you now"]} rows={rows.map((r) => [r.name, naira(r.invoiced), naira(r.paid), r.owed > 0 ? <strong key="o">{naira(r.owed)}</strong> : naira(0)])} foot={["Total", sum("invoiced"), sum("paid"), sum("owed")]} />
        {rows.length > 0 && rows[0].invoiced > 0 && <p className="mt-3 text-sm text-muted">{rows[0].name} is your biggest client this period at {Math.round((rows[0].invoiced / Math.max(1, rows.reduce((s, r) => s + r.invoiced, 0))) * 100)}% of invoicing.</p>}
      </>
    );
  }

  if (slug === "aged-receivables") {
    const owed = await receivables(id);
    const byClient = new Map<string, { name: string; items: { amount: number; late: number }[] }>();
    for (const r of owed.rows) (byClient.get(r.inv.customerId) ?? byClient.set(r.inv.customerId, { name: r.inv.customer.name, items: [] }).get(r.inv.customerId)!).items.push({ amount: r.dueNgn, late: r.late });
    const rows = [...byClient.values()].map((c) => ({ name: c.name, a: agingOf(c.items) })).sort((x, y) => y.a.total - x.a.total);
    body = <Table head={["Client", ...agingHead]} rows={rows.map((r) => [r.name, ...agingCells(r.a)])} foot={["Total", ...agingCells(owed.aging)]} />;
  }

  if (slug === "client-deposits") {
    const deposits = await db.invoice.findMany({ where: { businessId: id, depositForId: { not: null }, amountPaid: { gt: 0 } }, include: { customer: true } });
    const quoteIds = deposits.map((d) => d.depositForId!);
    const quotes = await db.invoice.findMany({ where: { id: { in: quoteIds } }, select: { id: true, number: true, status: true } });
    const open = deposits.filter((d) => quotes.find((q) => q.id === d.depositForId)?.status !== "CONVERTED");
    body = (
      <>
        <Table head={["Client", "Quote", "Deposit invoice", "Paid"]} align={["l", "l", "l", "r"]}
          rows={open.map((d) => [d.customer.name, quotes.find((q) => q.id === d.depositForId)?.number ?? "—", <Link key="d" href={`/app/invoices/${d.id}`} className="text-brand underline">{d.number}</Link>, naira(d.amountPaid * d.exchangeRate)])}
          foot={["Total held", "", "", naira(round2(open.reduce((s, d) => s + d.amountPaid * d.exchangeRate, 0)))]} />
        <p className="mt-3 text-sm text-muted">Deposits are credited automatically when you turn the quote into its final invoice.</p>
      </>
    );
  }

  if (slug === "purchases-by-supplier") {
    const expenses = await db.expense.findMany({ where: { businessId: id, date: { gte: from, lt: to }, payRunId: null } });
    const m = new Map<string, { total: number; unpaid: number; count: number }>();
    for (const e of expenses) {
      const k = e.vendor?.trim() || `(No supplier) ${e.category}`;
      const r = m.get(k) ?? m.set(k, { total: 0, unpaid: 0, count: 0 }).get(k)!;
      r.total += e.amount; r.count++; if (!e.paid) r.unpaid += e.amount;
    }
    const rows = [...m.entries()].sort((a, b) => b[1].total - a[1].total);
    body = <Table head={["Supplier", "Entries", "Total spend", "Still unpaid"]} rows={rows.map(([k, v]) => [k, String(v.count), naira(round2(v.total)), v.unpaid ? naira(round2(v.unpaid)) : "—"])} foot={["Total", String(expenses.length), naira(round2(expenses.reduce((s, e) => s + e.amount, 0))), naira(round2(expenses.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0)))]} />;
  }

  if (slug === "aged-payables") {
    const bills = await payables(id);
    const now = new Date();
    body = (
      <>
        <Table head={agingHead} rows={[agingCells(bills.aging)]} />
        <h2 className="mb-3 mt-6 text-lg">Unpaid bills</h2>
        <Table head={["Supplier", "Category", "Due", "Status", "Amount"]} align={["l", "l", "l", "l", "r"]}
          rows={bills.rows.map(({ bill, due }) => {
            const late = daysBetween(due, now);
            return [<Link key="s" href={`/app/expenses/${bill.id}`} className="text-brand underline">{bill.vendor || "—"}</Link>, bill.category, formatDate(due), late > 0 ? <Badge key="b" tone="danger">{late} days overdue</Badge> : <Badge key="b" tone="sun">Coming due</Badge>, naira(bill.amount)];
          })} />
      </>
    );
  }

  if (slug === "payroll-summary") {
    // People actually paid (a run can be paid in parts); run totals are rebuilt from them.
    const paidRuns = await db.payRun.findMany({ where: { businessId: id, status: { in: ["PAID", "PARTIAL"] }, payDate: { gte: from, lt: to } }, include: { items: { where: { paidAt: { not: null } } } }, orderBy: { period: "asc" } });
    const total = (items: (typeof paidRuns)[number]["items"], k: "gross" | "paye" | "pensionEmployee" | "pensionEmployer" | "wht" | "net") => round2(items.reduce((s, i) => s + i[k], 0));
    const runs = paidRuns.map((r) => ({ ...r, gross: total(r.items, "gross"), paye: total(r.items, "paye"), pensionEmployee: total(r.items, "pensionEmployee"), pensionEmployer: total(r.items, "pensionEmployer"), wht: total(r.items, "wht"), net: total(r.items, "net") }));
    const people = new Map<string, { name: string; gross: number; paye: number; pension: number; wht: number; net: number }>();
    for (const r of runs) for (const i of r.items) {
      const p = people.get(i.employeeId) ?? people.set(i.employeeId, { name: i.fullName, gross: 0, paye: 0, pension: 0, wht: 0, net: 0 }).get(i.employeeId)!;
      p.gross += i.gross; p.paye += i.paye; p.pension += i.pensionEmployee; p.wht += i.wht; p.net += i.net;
    }
    const sum = (k: "gross" | "paye" | "pensionEmployee" | "pensionEmployer" | "wht" | "net") => naira(round2(runs.reduce((s, r) => s + r[k], 0)));
    body = (
      <div className="space-y-6">
        <Table head={["Month", "Gross pay", "PAYE", "Pension (staff)", "Pension (company)", "Contractor WHT", "Take-home"]}
          rows={runs.map((r) => [periodLabel(r.period), naira(r.gross), naira(r.paye), naira(r.pensionEmployee), naira(r.pensionEmployer), naira(r.wht), naira(r.net)])}
          foot={["Total", sum("gross"), sum("paye"), sum("pensionEmployee"), sum("pensionEmployer"), sum("wht"), sum("net")]} />
        <h2 className="text-lg">By person</h2>
        <Table head={["Name", "Gross", "PAYE", "Pension", "WHT", "Take-home"]}
          rows={[...people.values()].sort((a, b) => b.gross - a.gross).map((p) => [p.name, naira(round2(p.gross)), naira(round2(p.paye)), naira(round2(p.pension)), naira(round2(p.wht)), naira(round2(p.net))])} />
        <p className="text-sm text-muted">Only people marked as paid are included. Use the PAYE column for your annual employer return (Form H1).</p>
      </div>
    );
  }

  if (slug === "transactions") {
    const [payments, expenses] = await Promise.all([
      db.payment.findMany({ where: { businessId: id, paidAt: { gte: from, lt: to } }, include: { invoice: { include: { customer: true } } } }),
      db.expense.findMany({ where: paidExpensesWhere(id, from, to) }),
    ]);
    const tx = [
      ...payments.map((p) => ({ date: p.paidAt, desc: p.invoice ? `${p.invoice.customer.name} · ${p.invoice.number}${p.invoice.currency !== "NGN" ? ` · ${money(p.amount, p.invoice.currency)} at ₦${p.exchangeRate.toLocaleString("en-NG")}` : ""}` : "Payment", method: PAYMENT_METHODS[p.method] ?? p.method, amount: round2(p.amount * p.exchangeRate) })),
      ...expenses.map((e) => ({ date: cashDate(e), desc: [e.vendor, e.category].filter(Boolean).join(" · "), method: e.payRunId ? "Payroll" : PAYMENT_METHODS[e.method] ?? e.method, amount: -e.amount })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const totals = tx.reduce<number[]>((acc, t) => [...acc, (acc.at(-1) ?? 0) + t.amount], []);
    const net = totals.at(-1) ?? 0;
    body = (
      <Table head={["Date", "Description", "Method", "In", "Out", "Running total"]} align={["l", "l", "l", "r", "r", "r"]}
        rows={tx.map((t, i) => [formatDate(t.date), t.desc, t.method, t.amount > 0 ? naira(t.amount) : "", t.amount < 0 ? naira(-t.amount) : "", naira(round2(totals[i]))])}
        foot={["Net", "", "", naira(round2(tx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0))), naira(round2(-tx.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0))), naira(round2(net))]} />
    );
  }

  return (
    <>
      {/* A statement prints as the document alone: its own header carries the title and period. */}
      <div className={statement ? "no-print" : undefined}>
      <PageHeader title={REPORT_TITLES[slug]} back={{ href: "/app/reports", label: "Reports" }}
        description={<>{business.legalName || business.name} · {NO_PERIOD.includes(slug) ? `as of ${formatDate(new Date())}` : range}</>}
        actions={<>
          {(slug === "profit-and-loss" || slug === "cash-flow" || slug === "transactions") && (
            <a href={`/app/reports/export?period=${period}`} download className="no-print inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-paper px-5 text-[0.95rem] font-semibold hover:border-ink"><Download className="size-4" aria-hidden /> CSV</a>
          )}
          <PrintButton className="no-print inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-paper px-5 text-[0.95rem] font-semibold hover:border-ink"><Printer className="size-4" aria-hidden /> {statement ? "Print or save PDF" : "Print / PDF"}</PrintButton>
        </>} />
      {!NO_PERIOD.includes(slug) && <div className="mb-5"><PeriodNav slug={slug} period={period} basis={sp.basis} /></div>}
      </div>
      {body}
    </>
  );
}
