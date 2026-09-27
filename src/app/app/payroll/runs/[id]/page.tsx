import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { periodLabel } from "@/lib/payroll";
import { TAX_DEADLINES } from "@/lib/constants";
import { dateInput, formatDate } from "@/lib/utils";
import { deletePayRun, markPayRunPaid, refreshPayRun, reopenPayRun } from "@/app/actions/payroll";
import { Badge, buttonClass, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/form-bits";
import { EmailPayslips } from "@/components/payroll-bits";

export const metadata = { title: "Pay run" };

export default async function PayRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { business } = await requireBusiness();
  const { id } = await params;
  const run = await db.payRun.findFirst({ where: { id, businessId: business.id }, include: { items: { orderBy: { fullName: "asc" } } } });
  if (!run) notFound();
  const draft = run.status === "DRAFT";
  const [y, m] = run.period.split("-").map(Number);
  const payeDue = new Date(y, m, TAX_DEADLINES.payeDay);
  const whtDue = new Date(y, m, TAX_DEADLINES.whtDay);
  const missingBank = run.items.filter((i) => !i.accountNumber).length;

  return (
    <>
      <PageHeader
        title={`${periodLabel(run.period)} payroll`}
        back={{ href: "/app/payroll", label: "Payroll" }}
        description={<>Pay date {formatDate(run.payDate)} · <Badge tone={draft ? "sun" : "brand"}>{draft ? "Draft" : `Paid ${formatDate(run.paidAt)}`}</Badge></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pay out to team" value={naira(run.net)} tone="brand" hint="Total take-home" />
        <Stat label="PAYE to remit" value={naira(run.paye)} tone="sun" hint={`By ${formatDate(payeDue, { day: "numeric", month: "short" })} to your state IRS`} />
        <Stat label="Pension to remit" value={naira(run.pensionEmployee + run.pensionEmployer)} tone="sun" hint={`Within ${TAX_DEADLINES.pensionWorkingDays} working days of pay day`} />
        <Stat label={run.wht > 0 ? "Contractor WHT to remit" : "Gross payroll"} value={naira(run.wht > 0 ? run.wht : run.gross)} hint={run.wht > 0 ? `By ${formatDate(whtDue, { day: "numeric", month: "short" })}` : undefined} />
      </div>

      {draft ? (
        <Panel className="mt-5 p-5">
          <h2 className="text-lg">How to pay this run</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
            <li>Check the amounts below. Changed someone's pay? Edit them in Team, then press “Recalculate”.</li>
            <li>Download the bank schedule and upload it to your bank's bulk transfer, or pay each person yourself.</li>
            <li>Mark the run as paid. BizBooks records the salary and pension cost in your books.</li>
          </ol>
          {missingBank > 0 && <Notice tone="sun" className="mt-3">{missingBank} {missingBank > 1 ? "people have" : "person has"} no bank details, so they're left out of the bank schedule.</Notice>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/app/payroll/runs/${run.id}/bank-schedule`} className={buttonClass("secondary")}><Download className="size-4" aria-hidden /> Bank schedule (CSV)</a>
            <form action={markPayRunPaid}><input type="hidden" name="id" value={run.id} />
              <ConfirmButton message={`Mark ${periodLabel(run.period)} payroll as paid? This records ${naira(run.gross + run.pensionEmployer)} of payroll cost in your books.`} className={buttonClass("primary")}>I've paid everyone</ConfirmButton>
            </form>
          </div>
          <form action={refreshPayRun} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <input type="hidden" name="id" value={run.id} />
            <label className="text-sm font-semibold">Pay date
              <input type="date" name="payDate" defaultValue={dateInput(run.payDate)} className="mt-1 block min-h-10 rounded-xl border border-line-strong px-3" />
            </label>
            <SubmitButton variant="secondary" size="sm">Recalculate from team</SubmitButton>
          </form>
        </Panel>
      ) : (
        <Panel className="mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-ink-soft">Recorded in your books as salary and pension expenses on {formatDate(run.payDate)}. Remember to remit PAYE and pension.</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/app/payroll/runs/${run.id}/bank-schedule`} className={buttonClass("secondary", "sm")}><Download className="size-4" aria-hidden /> Bank schedule</a>
            <form action={reopenPayRun}><input type="hidden" name="id" value={run.id} />
              <ConfirmButton message="Reopen this run? The salary expenses it added will be removed until you mark it paid again." className={buttonClass("ghost", "sm")}>Reopen</ConfirmButton>
            </form>
          </div>
        </Panel>
      )}

      <div className="mt-5"><EmailPayslips id={run.id} /></div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-paper">
        <table className="num w-full min-w-[44rem] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th scope="col" className="p-3 font-semibold">Name</th>
              <th scope="col" className="p-3 text-right font-semibold">Gross</th>
              <th scope="col" className="p-3 text-right font-semibold">Pension</th>
              <th scope="col" className="p-3 text-right font-semibold">PAYE / WHT</th>
              <th scope="col" className="p-3 text-right font-semibold">Take-home</th>
              <th scope="col" className="p-3"><span className="sr-only">Payslip</span></th>
            </tr>
          </thead>
          <tbody>
            {run.items.map((i) => (
              <tr key={i.id} className="border-t border-line">
                <td className="p-3"><p className="font-semibold">{i.fullName}</p><p className="text-xs text-muted">{i.kind === "CONTRACTOR" ? "Contractor" : i.jobTitle ?? "Staff"}</p></td>
                <td className="p-3 text-right">{naira(i.gross)}</td>
                <td className="p-3 text-right">{i.pensionEmployee ? `−${naira(i.pensionEmployee)}` : "—"}</td>
                <td className="p-3 text-right">−{naira(i.paye + i.wht)}</td>
                <td className="p-3 text-right font-bold">{naira(i.net)}</td>
                <td className="p-3 text-right"><Link href={`/payslip/${i.publicToken}`} target="_blank" className="inline-flex min-h-9 items-center gap-1 font-semibold text-brand hover:underline"><FileText className="size-4" aria-hidden />Payslip</Link></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line font-bold">
            <tr>
              <td className="p-3">Total</td>
              <td className="p-3 text-right">{naira(run.gross)}</td>
              <td className="p-3 text-right">−{naira(run.pensionEmployee)}</td>
              <td className="p-3 text-right">−{naira(run.paye + run.wht)}</td>
              <td className="p-3 text-right">{naira(run.net)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {draft && (
        <form action={deletePayRun} className="mt-6">
          <input type="hidden" name="id" value={run.id} />
          <ConfirmButton message="Delete this draft pay run?" className={buttonClass("ghost", "sm", "text-danger")}>Delete draft</ConfirmButton>
        </form>
      )}
    </>
  );
}
