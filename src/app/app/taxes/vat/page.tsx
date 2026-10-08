import Link from "next/link";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { isPeriod, lastMonth, vatReturn } from "@/lib/vat-return";
import { periodLabel } from "@/lib/payroll";
import { naira } from "@/lib/money";
import { cn, formatDate } from "@/lib/utils";
import { markTaxFiled, unmarkTaxFiled } from "@/app/actions/taxes";
import { buttonClass, Input, Notice, PageHeader, Panel } from "@/components/ui";
import { DownloadPdfButton } from "@/components/pdf-download";

export const metadata = { title: "VAT return" };

function months(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 1 - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function Line({ n, label, value, strong, hint }: { n: string; label: string; value: number; strong?: boolean; hint?: string }) {
  return (
    <div className={cn("grid grid-cols-[2rem_1fr_auto] items-baseline gap-3 py-2.5", strong && "font-semibold")}>
      <span className="text-xs font-semibold text-muted">{n}</span>
      <span>{label}{hint && <span className="block text-xs font-normal text-muted">{hint}</span>}</span>
      <span className={cn("num text-right", strong && "text-base")}>{naira(value)}</span>
    </div>
  );
}

export default async function VatReturnPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { business: b } = await requireBusiness();
  const { month } = await searchParams;
  const period = isPeriod(month) ? month : lastMonth();
  const r = await vatReturn(b.id, period);
  const t = r.totals;
  const credit = t.net < 0;

  return (
    <>
      <PageHeader
        title="VAT return"
        back={{ href: "/app/taxes", label: "Taxes" }}
        description="Your monthly VAT return worked out from your invoices and purchases, laid out to copy into the VAT return on TaxPro-Max."
      />
      {!b.vatRegistered && (
        <Notice tone="sun" className="mb-5" title="You've told us you don't charge VAT">
          If you&apos;re registered for VAT, switch it on in <Link href="/app/settings" className="font-semibold underline">Settings</Link> so your invoices charge it. Ask your adviser if you&apos;re not sure whether you need to register.
        </Notice>
      )}

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold" htmlFor="vat-month">Month</label>
        <div className="flex flex-wrap gap-1.5">
          {months(6).map((p) => (
            <Link key={p} href={`/app/taxes/vat?month=${p}`} className={cn("rounded-full border px-3 py-1 text-sm font-semibold", p === period ? "border-ink bg-ink text-paper" : "border-line text-ink-soft hover:border-ink")}>
              {periodLabel(p).replace(/ \d{4}$/, "")}
            </Link>
          ))}
        </div>
        <form className="ml-auto flex items-center gap-2">
          <Input id="vat-month" name="month" type="month" defaultValue={period} className="w-44" />
          <button className={buttonClass("ghost", "sm")}>Go</button>
        </form>
      </div>

      <div className="no-print mb-5 grid gap-3 doc:grid-cols-[1fr_auto]">
        <Panel className={cn("flex flex-wrap items-center gap-4 p-5", r.filing ? "border-brand/40" : "")}>
          {r.filing ? <CheckCircle2 className="size-6 text-brand" aria-hidden /> : <AlertTriangle className={cn("size-6", r.dueDate < new Date() ? "text-danger" : "text-sun")} aria-hidden />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              {r.filing ? `Filed ${formatDate(r.filing.paidAt)}${r.filing.reference ? ` · ref ${r.filing.reference}` : ""}` : `${credit ? "File by" : "File and pay by"} ${formatDate(r.dueDate)}`}
            </p>
            <p className="text-sm text-muted">{credit ? `No VAT to pay: ${naira(-t.net)} input VAT carries forward. You still file a nil return.` : t.net === 0 && !r.sales.length ? "No VAT activity: file a nil return." : `VAT payable for ${r.label}: ${naira(t.net)}`}</p>
          </div>
          {r.filing ? (
            <form action={unmarkTaxFiled}>
              <input type="hidden" name="kind" value="VAT" /><input type="hidden" name="period" value={period} />
              <button className={buttonClass("ghost", "sm")}>Undo</button>
            </form>
          ) : (
            <form action={markTaxFiled} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="kind" value="VAT" /><input type="hidden" name="period" value={period} />
              <input type="hidden" name="amount" value={Math.max(0, t.net)} />
              <Input name="reference" placeholder="Payment ref (optional)" className="w-52" aria-label="Payment reference" />
              <button className={buttonClass("primary", "sm")}>Mark as filed</button>
            </form>
          )}
        </Panel>
        <div className="flex flex-wrap items-center gap-2">
          <DownloadPdfButton filename={`VAT return ${r.label} ${b.name}.pdf`} className={buttonClass("secondary", "sm")} />
          <a href={`/app/taxes/vat/export?month=${period}&type=sales`} className={buttonClass("secondary", "sm")}><Download className="size-4" aria-hidden /> Sales CSV</a>
          <a href={`/app/taxes/vat/export?month=${period}&type=purchases`} className={buttonClass("secondary", "sm")}><Download className="size-4" aria-hidden /> Purchases CSV</a>
        </div>
      </div>

      {(r.missingTins > 0 || r.missingVendors > 0) && (
        <Notice tone="info" className="no-print mb-5" title="Worth fixing before you file">
          {r.missingTins > 0 && <>{r.missingTins} VAT invoice{r.missingTins === 1 ? " has a client" : "s have clients"} with no TIN. Add it on the client&apos;s page. </>}
          {r.missingVendors > 0 && <>{r.missingVendors} purchase{r.missingVendors === 1 ? "" : "s"} claiming input VAT {r.missingVendors === 1 ? "has" : "have"} no supplier name: you&apos;ll need the supplier&apos;s VAT invoice to claim it.</>}
        </Notice>
      )}

      <article className="print-sheet rounded-2xl border border-line bg-paper p-5 doc:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="text-lg font-bold">{b.legalName || b.name}</p>
            <p className="text-sm text-muted">{[b.tin && `TIN ${b.tin}`, b.rcNumber && `RC ${b.rcNumber}`].filter(Boolean).join(" · ") || "Add your TIN in Settings"}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">VAT return: {r.label}</p>
            <p className="text-sm text-muted">Due {formatDate(r.dueDate)} · prepared {formatDate(new Date())}</p>
          </div>
        </header>

        <section className="mt-4 divide-y divide-line text-sm">
          <Line n="1" label="Total supplies (sales) in the month" value={t.totalSupplies} hint="Before VAT, in naira" />
          <Line n="2" label="Exempt and zero-rated supplies" value={t.exemptSupplies} hint="Invoices with no VAT. Check each is genuinely exempt or zero-rated" />
          <Line n="3" label="Supplies subject to VAT (1 − 2)" value={t.vatableSupplies} />
          <Line n="4" label="Output VAT charged" value={t.output} strong />
          <Line n="5" label="Purchases with VAT, before VAT" value={t.purchasesNet} />
          <Line n="6" label="Input VAT claimable" value={t.input} hint="Only with the supplier's VAT invoice or receipt" />
          <Line n="7" label={credit ? "Input VAT to carry forward (6 − 4)" : "VAT payable (4 − 6)"} value={Math.abs(t.net)} strong />
        </section>

        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold">Schedule of sales with VAT ({r.sales.length})</h2>
          {r.sales.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] table-fixed text-sm">
                <colgroup><col className="w-[15%]" /><col className="w-[14%]" /><col /><col className="w-[17%]" /><col className="w-[17%]" /><col className="w-[15%]" /></colgroup>
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2">Date</th><th className="py-2">Invoice</th><th className="py-2">Client</th><th className="py-2">TIN</th><th className="py-2 text-right">Net</th><th className="py-2 text-right">VAT</th>
                </tr></thead>
                <tbody>
                  {r.sales.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top">
                      <td className="py-2">{formatDate(s.date)}</td>
                      <td className="num py-2"><Link href={`/app/invoices/${s.id}`} className="hover:underline">{s.number}</Link></td>
                      <td className="py-2 pr-2">{s.customer}{s.currency !== "NGN" && <span className="block text-xs text-muted">{s.currency}, converted</span>}</td>
                      <td className={cn("num py-2", !s.tin && "text-muted")}>{s.tin || "–"}</td>
                      <td className="num py-2 text-right">{naira(s.net)}</td>
                      <td className="num py-2 text-right">{naira(s.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No invoices with VAT in {r.label}.</p>}
        </section>

        {r.exempt.length > 0 && (
          <section className="mt-8 break-inside-avoid">
            <h2 className="mb-2 text-base font-semibold">Sales without VAT ({r.exempt.length})</h2>
            <ul className="divide-y divide-line text-sm">
              {r.exempt.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2"><span>{formatDate(s.date)} · <Link href={`/app/invoices/${s.id}`} className="num hover:underline">{s.number}</Link> · {s.customer}</span><span className="num">{naira(s.net)}</span></li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 break-inside-avoid">
          <h2 className="mb-2 text-base font-semibold">Schedule of purchases with input VAT ({r.purchases.length})</h2>
          {r.purchases.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] table-fixed text-sm">
                <colgroup><col className="w-[15%]" /><col /><col className="w-[22%]" /><col className="w-[17%]" /><col className="w-[15%]" /></colgroup>
                <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
                  <th className="py-2">Date</th><th className="py-2">Supplier</th><th className="py-2">Category</th><th className="py-2 text-right">Net</th><th className="py-2 text-right">VAT</th>
                </tr></thead>
                <tbody>
                  {r.purchases.map((p) => (
                    <tr key={p.id} className="border-b border-line align-top">
                      <td className="py-2">{formatDate(p.date)}</td>
                      <td className={cn("py-2 pr-2", p.vendor === "Not recorded" && "text-muted")}><Link href={`/app/expenses/${p.id}`} className="hover:underline">{p.vendor}</Link></td>
                      <td className="py-2 pr-2 text-ink-soft">{p.category}</td>
                      <td className="num py-2 text-right">{naira(p.net)}</td>
                      <td className="num py-2 text-right">{naira(p.vat)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-muted">No purchases with VAT recorded in {r.label}. Add the VAT amount when you record an expense to claim it.</p>}
        </section>

        <p className="mt-8 text-xs text-muted">Prepared by BizBooks from the records kept. Check exempt and zero-rated sales and keep suppliers&apos; VAT invoices for every input VAT claim. Your accountant or tax adviser has the final word.</p>
      </article>
    </>
  );
}
