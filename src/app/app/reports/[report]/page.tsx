import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERIODS, periodRange, previousRange, profitAndLoss, vatSummary, type Period } from "@/lib/reports";
import { accrualTotals, agingOf, cashDate, paidExpensesWhere, payables, type Aging } from "@/lib/finance";
import { receivables } from "@/lib/stats";
import { naira, round2 } from "@/lib/money";
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
    <nav aria-label="Report period" className="no-print -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
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

const agingHead = ["Coming due", "1–30 days", "31–60 days", "61–90 days", "90+ days", "Total"];
const agingCells = (a: Aging) => [a.comingDue, a.d1_30, a.d31_60, a.d61_90, a.d90plus, a.total].map((v) => naira(round2(v)));

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

  if (slug === "profit-and-loss") {
    const basis = sp.basis === "cash" ? "cash" : "accrual";
    const prev = previousRange(period);
    let cur: { income: number; expenses: number; net: number; categories: { name: string; amount: number }[] };
    let before: typeof cur;
    if (basis === "accrual") {
      [cur, before] = await Promise.all([accrualTotals(id, from, to), accrualTotals(id, prev.from, prev.to)]);
    } else {
      const [c, b] = await Promise.all([profitAndLoss(id, from, to), profitAndLoss(id, prev.from, prev.to)]);
      const shape = (p: typeof c) => ({ income: p.income, expenses: round2(p.moneyOut - p.inputVat), net: p.profit, categories: p.categories });
      cur = shape(c);
      before = shape(b);
    }
    const prevCat = new Map(before.categories.map((c) => [c.name, c.amount]));
    body = (
      <>
        <nav aria-label="Basis" className="no-print mb-4 flex gap-1 rounded-full bg-paper p-1 text-sm font-semibold ring-1 ring-line sm:w-fit">
          {[["accrual", "Accrual (invoiced)"], ["cash", "Cash (paid)"]].map(([b, l]) => (
            <Link key={b} href={`/app/reports/profit-and-loss?period=${period}&basis=${b}`} aria-current={basis === b ? "true" : undefined} className={cn("inline-flex min-h-9 flex-1 items-center justify-center whitespace-nowrap rounded-full px-4", basis === b ? "bg-ink text-white" : "text-muted")}>{l}</Link>
          ))}
        </nav>
        <Table
          head={["", "This period", prev.label.replace(/^the /, "")]}
          rows={[
            [<strong key="i">Income</strong>, naira(cur.income), naira(before.income)],
            ...cur.categories.map((c) => [<span key={c.name} className="pl-4 text-ink-soft">{c.name}</span>, `−${naira(c.amount)}`, prevCat.has(c.name) ? `−${naira(prevCat.get(c.name)!)}` : "—"]),
            [<strong key="e">Total expenses</strong>, `−${naira(cur.expenses)}`, `−${naira(before.expenses)}`],
          ]}
          foot={[cur.net >= 0 ? "Net profit" : "Net loss", naira(cur.net), naira(before.net)]}
        />
        <p className="mt-3 text-sm text-muted">
          {basis === "accrual" ? "Accrual: income when you invoice, expenses and bills when they're dated, whether paid or not." : "Cash: income when clients pay, expenses when money leaves your account."} Amounts exclude VAT.
        </p>
      </>
    );
  }

  if (slug === "cash-flow") {
    const [payments, expenses] = await Promise.all([
      db.payment.findMany({ where: { businessId: id, paidAt: { gte: from, lt: to } } }),
      db.expense.findMany({ where: paidExpensesWhere(id, from, to) }),
    ]);
    const byMonth = new Map<string, { inflow: number; outflow: number; payroll: number }>();
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const row = (k: string) => byMonth.get(k) ?? byMonth.set(k, { inflow: 0, outflow: 0, payroll: 0 }).get(k)!;
    for (const p of payments) row(key(p.paidAt)).inflow += p.amount;
    for (const e of expenses) { const r = row(key(cashDate(e))); if (e.payRunId) r.payroll += e.amount; else r.outflow += e.amount; }
    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    const t = months.reduce((s, [, v]) => ({ inflow: s.inflow + v.inflow, outflow: s.outflow + v.outflow, payroll: s.payroll + v.payroll }), { inflow: 0, outflow: 0, payroll: 0 });
    body = (
      <Table
        head={["Month", "Received from clients", "Expenses & bills paid", "Payroll", "Net change"]}
        rows={months.map(([k, v]) => [periodLabel(k), naira(v.inflow), `−${naira(v.outflow)}`, `−${naira(v.payroll)}`, <span key="n" className={v.inflow - v.outflow - v.payroll < 0 ? "text-danger" : ""}>{naira(round2(v.inflow - v.outflow - v.payroll))}</span>])}
        foot={["Total", naira(t.inflow), `−${naira(t.outflow)}`, `−${naira(t.payroll)}`, naira(round2(t.inflow - t.outflow - t.payroll))]}
      />
    );
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
          rows={v.invoices.map((i) => [formatDate(i.issueDate), i.number, i.customer.name, i.customer.tin ?? "—", naira(i.subtotal - i.discount), naira(i.vatAmount)])}
          foot={["Total", "", "", "", naira(round2(v.invoices.reduce((s, i) => s + i.subtotal - i.discount, 0))), naira(v.output)]} />
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
    for (const i of invoices) get(i.customerId, i.customer.name).invoiced += i.total;
    for (const p of payments) if (p.invoice) get(p.invoice.customerId, p.invoice.customer.name).paid += p.amount;
    for (const r of owed.rows) get(r.inv.customerId, r.inv.customer.name).owed += r.due;
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
    for (const r of owed.rows) (byClient.get(r.inv.customerId) ?? byClient.set(r.inv.customerId, { name: r.inv.customer.name, items: [] }).get(r.inv.customerId)!).items.push({ amount: r.due, late: r.late });
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
          rows={open.map((d) => [d.customer.name, quotes.find((q) => q.id === d.depositForId)?.number ?? "—", <Link key="d" href={`/app/invoices/${d.id}`} className="text-brand underline">{d.number}</Link>, naira(d.amountPaid)])}
          foot={["Total held", "", "", naira(round2(open.reduce((s, d) => s + d.amountPaid, 0)))]} />
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
    const runs = await db.payRun.findMany({ where: { businessId: id, status: "PAID", payDate: { gte: from, lt: to } }, include: { items: true }, orderBy: { period: "asc" } });
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
        <p className="text-sm text-muted">Only pay runs marked as paid are included. Use the PAYE column for your annual employer return (Form H1).</p>
      </div>
    );
  }

  if (slug === "transactions") {
    const [payments, expenses] = await Promise.all([
      db.payment.findMany({ where: { businessId: id, paidAt: { gte: from, lt: to } }, include: { invoice: { include: { customer: true } } } }),
      db.expense.findMany({ where: paidExpensesWhere(id, from, to) }),
    ]);
    const tx = [
      ...payments.map((p) => ({ date: p.paidAt, desc: p.invoice ? `${p.invoice.customer.name} · ${p.invoice.number}` : "Payment", method: PAYMENT_METHODS[p.method] ?? p.method, amount: p.amount })),
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
      <PageHeader title={REPORT_TITLES[slug]} back={{ href: "/app/reports", label: "Reports" }}
        description={<>{business.legalName || business.name} · {NO_PERIOD.includes(slug) ? `as of ${formatDate(new Date())}` : range}</>}
        actions={<PrintButton className="no-print inline-flex min-h-11 items-center rounded-full border border-line-strong bg-paper px-5 text-[0.95rem] font-semibold hover:border-ink">Print / PDF</PrintButton>} />
      {!NO_PERIOD.includes(slug) && <div className="mb-5"><PeriodNav slug={slug} period={period} basis={sp.basis} /></div>}
      {body}
    </>
  );
}
