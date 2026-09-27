import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { amountInWords, naira } from "@/lib/money";
import { periodLabel } from "@/lib/payroll";
import { formatDate, initials } from "@/lib/utils";
import { PrintButton } from "@/components/form-bits";

export const metadata: Metadata = { title: "Payslip", robots: { index: false, follow: false } };

export default async function Payslip({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const item = await db.payItem.findUnique({ where: { publicToken: token }, include: { payRun: { include: { business: true } }, employee: true } });
  if (!item) notFound();
  const b = item.payRun.business;
  const contractor = item.kind === "CONTRACTOR";
  const rows: [string, number][] = contractor
    ? [["Withholding tax", item.wht]]
    : [["Pension (8%)", item.pensionEmployee], ["National Housing Fund", item.nhf], ["PAYE tax", item.paye]];

  return (
    <main className="min-h-dvh bg-canvas px-3 py-6 sm:py-10">
      <article className="print-sheet mx-auto max-w-2xl rounded-2xl border border-line bg-paper p-6 shadow-sm sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {b.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.logo} alt={`${b.name} logo`} className="max-h-14 max-w-36 object-contain" />
            ) : (
              <span className="grid size-12 place-items-center rounded-xl font-bold text-white" style={{ background: b.brandColor }}>{initials(b.name)}</span>
            )}
            <div className="text-sm"><p className="font-bold">{b.legalName || b.name}</p>{b.rcNumber && <p className="text-muted">RC {b.rcNumber}</p>}</div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold uppercase tracking-wide" style={{ color: b.brandColor }}>{contractor ? "Payment advice" : "Payslip"}</p>
            <p className="font-semibold">{periodLabel(item.payRun.period)}</p>
          </div>
        </header>

        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Name</dt><dd className="font-semibold">{item.fullName}</dd>
          <dt className="text-muted">{contractor ? "Service" : "Job title"}</dt><dd>{item.jobTitle ?? "—"}</dd>
          <dt className="text-muted">Pay date</dt><dd>{formatDate(item.payRun.payDate)}</dd>
          {item.employee.pensionPin && <><dt className="text-muted">RSA PIN</dt><dd>{item.employee.pensionPin}</dd></>}
          {item.accountNumber && <><dt className="text-muted">Paid to</dt><dd>{item.bankName} · {item.accountNumber}</dd></>}
        </dl>

        <table className="num mt-8 w-full text-sm">
          <tbody>
            <tr className="border-b border-line"><th scope="row" className="py-2.5 text-left font-semibold">{contractor ? "Fee" : "Gross pay"}</th><td className="py-2.5 text-right font-semibold">{naira(item.gross)}</td></tr>
            {rows.filter(([, v]) => v > 0).map(([label, v]) => (
              <tr key={label} className="border-b border-line text-ink-soft"><th scope="row" className="py-2.5 text-left font-normal">{label}</th><td className="py-2.5 text-right">−{naira(v)}</td></tr>
            ))}
            <tr><th scope="row" className="py-3 text-left text-base font-bold">Net pay</th><td className="py-3 text-right text-xl font-bold">{naira(item.net)}</td></tr>
          </tbody>
        </table>
        <p className="text-right text-xs italic text-muted">{amountInWords(item.net)}</p>
        {!contractor && item.pensionEmployer > 0 && (
          <p className="mt-6 rounded-xl bg-canvas p-3 text-sm text-ink-soft">Your employer also paid <strong className="num text-ink">{naira(item.pensionEmployer)}</strong> into your pension this month, on top of your pay.</p>
        )}
        {item.rentRelief > 0 && <p className="mt-2 text-sm text-muted">Rent relief applied: {naira(item.rentRelief)} a month tax-free.</p>}
      </article>
      <div className="no-print mt-4 flex justify-center"><PrintButton /></div>
    </main>
  );
}
