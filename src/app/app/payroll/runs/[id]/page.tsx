import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, FileText } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { periodLabel } from "@/lib/payroll";
import { TAX, TAX_DEADLINES } from "@/lib/constants";
import { dateInput, formatDate } from "@/lib/utils";
import { deletePayRun, markPayRunPaid, refreshPayRun, reopenPayRun, unmarkPayItem } from "@/app/actions/payroll";
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
  const unpaid = run.items.filter((i) => !i.paidAt);
  const paidCount = run.items.length - unpaid.length;
  // Runs paid before per-person payments existed recorded one combined expense, so they can only be reopened whole.
  const perPerson = paidCount === 0 || (await db.expense.count({ where: { payRunId: run.id, payItemId: { not: null } } })) > 0;
  const [y, m] = run.period.split("-").map(Number);
  const payeDue = new Date(y, m, TAX_DEADLINES.payeDay);
  const whtDue = new Date(y, m, TAX_DEADLINES.whtDay);
  const missingBank = unpaid.filter((i) => !i.accountNumber).length;
  const leftToPay = unpaid.reduce((s, i) => s + i.net, 0);
  const partly = unpaid.length > 0 && paidCount > 0;
  const status = run.status === "PAID" ? `Paid ${formatDate(run.paidAt)}` : run.status === "PARTIAL" ? `Partly paid · ${paidCount} of ${run.items.length}` : "Draft";

  return (
    <>
      <PageHeader
        title={`${periodLabel(run.period)} payroll`}
        back={{ href: "/app/payroll", label: "Payroll" }}
        description={<>Pay date {formatDate(run.payDate)} · <Badge tone={run.status === "PAID" ? "brand" : "sun"}>{status}</Badge></>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={partly ? "Left to pay" : "Pay out to team"} value={naira(partly ? leftToPay : run.net)} tone="brand" hint={partly ? `${unpaid.length} of ${run.items.length} people` : "Total take-home"} />
        <Stat label="PAYE to remit" value={naira(run.paye)} tone="sun" hint={`By ${formatDate(payeDue, { day: "numeric", month: "short" })} to your state IRS`} />
        <Stat label="Pension to remit" value={naira(run.pensionEmployee + run.pensionEmployer)} tone="sun" hint={`Within ${TAX_DEADLINES.pensionWorkingDays} working days of pay day`} />
        <Stat label={run.wht > 0 ? "Contractor WHT to remit" : "Gross payroll"} value={naira(run.wht > 0 ? run.wht : run.gross)} hint={run.wht > 0 ? `By ${formatDate(whtDue, { day: "numeric", month: "short" })}` : undefined} />
      </div>

      {unpaid.length > 0 ? (
        <Panel className="mt-5 p-5">
          <h2 className="text-lg">{paidCount ? "Pay the rest" : "How to pay this run"}</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-ink-soft">
            {draft && <li>Check the amounts below. Changed someone&apos;s pay? Edit them in Team, then press “Recalculate”.</li>}
            <li>Download the bank schedule and upload it to your bank&apos;s bulk transfer, or pay each person yourself.</li>
            <li>Tick the people you&apos;ve paid and press “Mark selected as paid”, or mark everyone at once. Each person&apos;s salary and pension is recorded in your books as you go.</li>
          </ol>
          {missingBank > 0 && <Notice tone="sun" className="mt-3">{missingBank} {missingBank > 1 ? "people have" : "person has"} no bank details, so they&apos;re left out of the bank schedule.</Notice>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`/app/payroll/runs/${run.id}/bank-schedule`} className={buttonClass("secondary")}><Download className="size-4" aria-hidden /> {paidCount ? `Bank schedule for the ${unpaid.length} left` : "Bank schedule (CSV)"}</a>
          </div>
          {draft ? (
            <form action={refreshPayRun} className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
              <input type="hidden" name="id" value={run.id} />
              <label className="text-sm font-semibold">Pay date
                <input type="date" name="payDate" defaultValue={dateInput(run.payDate)} className="mt-1 block min-h-10 rounded-xl border border-line-strong px-3" />
              </label>
              <SubmitButton variant="secondary" size="sm">Recalculate from team</SubmitButton>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">Amounts are locked once anyone is paid. To change them, undo those payments (or reopen the run) first.</p>
          )}
        </Panel>
      ) : (
        <Panel className="mt-5 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-ink-soft">Everyone is paid and recorded in your books as salary and pension expenses. Remember to remit PAYE and pension.</p>
          <a href={`/app/payroll/runs/${run.id}/bank-schedule`} className={buttonClass("secondary", "sm")}><Download className="size-4" aria-hidden /> Bank schedule</a>
        </Panel>
      )}

      <div className="mt-5"><EmailPayslips id={run.id} /></div>

      {/* One form: tick people and mark them paid. Each paid row's Undo has the person bound into its own action. */}
      <form action={markPayRunPaid} className="mt-5">
        <input type="hidden" name="id" value={run.id} />
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="num w-full min-w-[48rem] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="w-10 p-3"><span className="sr-only">Select</span></th>
                <th scope="col" className="p-3 font-semibold">Name</th>
                <th scope="col" className="p-3 text-right font-semibold">Gross</th>
                <th scope="col" className="p-3 text-right font-semibold">Pension</th>
                <th scope="col" className="p-3 text-right font-semibold">PAYE / WHT</th>
                <th scope="col" className="p-3 text-right font-semibold">Take-home</th>
                <th scope="col" className="p-3 font-semibold">Paid</th>
                <th scope="col" className="p-3"><span className="sr-only">Payslip</span></th>
              </tr>
            </thead>
            <tbody>
              {run.items.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="p-3">
                    {!i.paidAt && <input type="checkbox" name="item" value={i.id} aria-label={`Mark ${i.fullName} as paid`} className="size-5 accent-brand" />}
                  </td>
                  <td className="p-3"><p className="font-semibold">{i.fullName}</p><p className="text-xs text-muted">{i.kind === "CONTRACTOR" ? "Contractor" : i.jobTitle ?? "Staff"}</p></td>
                  <td className="p-3 text-right">{naira(i.gross)}</td>
                  <td className="p-3 text-right">{i.pensionEmployee ? `−${naira(i.pensionEmployee)}` : "—"}</td>
                  <td className="p-3 text-right">{i.payeByEmployee ? <span className="text-muted" title="This employee settles their own income tax">Employee pays</span> : i.paye + i.wht > 0 ? `−${naira(i.paye + i.wht)}` : <span className="text-muted">{i.kind === "EMPLOYEE" ? (i.gross <= TAX.minimumWageMonthly ? "Exempt" : "None") : "—"}</span>}</td>
                  <td className="p-3 text-right font-bold">{naira(i.net)}</td>
                  <td className="whitespace-nowrap p-3">
                    {i.paidAt ? (
                      <span className="inline-flex items-center gap-2">
                        <Badge tone="brand">{formatDate(i.paidAt, { day: "numeric", month: "short" })}</Badge>
                        {perPerson && <button formAction={unmarkPayItem.bind(null, i.id)} className="text-xs font-semibold text-muted underline hover:text-ink">Undo</button>}
                      </span>
                    ) : <span className="text-muted">Not yet</span>}
                  </td>
                  <td className="p-3 text-right"><Link href={`/payslip/${i.publicToken}`} target="_blank" className="inline-flex min-h-9 items-center gap-1 font-semibold text-brand hover:underline"><FileText className="size-4" aria-hidden />Payslip</Link></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line font-bold">
              <tr>
                <td />
                <td className="p-3">Total</td>
                <td className="p-3 text-right">{naira(run.gross)}</td>
                <td className="p-3 text-right">{run.pensionEmployee ? `−${naira(run.pensionEmployee)}` : "—"}</td>
                <td className="p-3 text-right">{run.paye + run.wht ? `−${naira(run.paye + run.wht)}` : "—"}</td>
                <td className="p-3 text-right">{naira(run.net)}</td>
                <td className="p-3 font-normal text-muted">{paidCount} of {run.items.length}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {unpaid.length > 0 && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-paper p-4">
            <label className="text-sm font-semibold">Paid on
              <input type="date" name="paidAt" defaultValue={dateInput(run.payDate)} className="mt-1 block min-h-10 rounded-xl border border-line-strong px-3" />
            </label>
            <SubmitButton variant="primary">Mark selected as paid</SubmitButton>
            <ConfirmButton name="op" value="all" message={`Mark all ${unpaid.length} people left as paid? Their salary and pension cost is recorded in your books.`} className={buttonClass("secondary")}>
              {paidCount ? `I've paid everyone left (${unpaid.length})` : "I've paid everyone"}
            </ConfirmButton>
          </div>
        )}
      </form>

      {!draft && (
        <form action={reopenPayRun} className="mt-4">
          <input type="hidden" name="id" value={run.id} />
          <ConfirmButton message="Reopen this run? Every payment marked on it is undone and its salary expenses are removed." className={buttonClass("ghost", "sm")}>Reopen the whole run</ConfirmButton>
        </form>
      )}

      {draft && (
        <form action={deletePayRun} className="mt-6">
          <input type="hidden" name="id" value={run.id} />
          <ConfirmButton message="Delete this draft pay run?" className={buttonClass("ghost", "sm", "text-danger")}>Delete draft</ConfirmButton>
        </form>
      )}
    </>
  );
}
