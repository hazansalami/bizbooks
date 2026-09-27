import Link from "next/link";
import { Users } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { computePay, payDateFor, periodLabel, periodOf } from "@/lib/payroll";
import { addMonths, formatDate } from "@/lib/utils";
import { createPayRun } from "@/app/actions/payroll";
import { Badge, ButtonLink, EmptyState, Notice, PageHeader, Panel, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";

export const metadata = { title: "Payroll" };

export default async function Payroll() {
  const { business } = await requireBusiness();
  const [team, runs] = await Promise.all([
    db.employee.findMany({ where: { businessId: business.id, status: "ACTIVE" } }),
    db.payRun.findMany({ where: { businessId: business.id }, orderBy: { period: "desc" }, take: 24 }),
  ]);

  if (team.length === 0 && runs.length === 0) {
    return (
      <>
        <PageHeader title="Payroll" />
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="Pay your team with PAYE and pension worked out"
          body="Add your staff and contractors once. Each month BizBooks works out PAYE, pension and withholding tax, gives you payslips and a bank upload file, and records it all in your books."
          action={<ButtonLink href="/app/payroll/team/new" size="lg">Add your first team member</ButtonLink>}
        />
      </>
    );
  }

  const estimate = team.map((e) => ({ e, p: computePay(e) }));
  const monthlyCost = estimate.reduce((s, x) => s + x.p.gross + x.p.pensionEmployer, 0);
  const monthlyNet = estimate.reduce((s, x) => s + x.p.net, 0);
  const staff = team.filter((e) => e.kind !== "CONTRACTOR").length;
  const now = new Date();
  // The month to run next: this month unless it's already been paid.
  const thisPeriod = periodOf(now);
  const nextPeriod = runs.some((r) => r.period === thisPeriod && r.status === "PAID") ? periodOf(addMonths(now, 1)) : thisPeriod;
  const nextRun = runs.find((r) => r.period === nextPeriod);

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Salaries, contractors, PAYE and pension in one place. You pay from your own bank; BizBooks does the maths and the paperwork."
        actions={<ButtonLink href="/app/payroll/team" variant="secondary">Team ({team.length})</ButtonLink>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Monthly payroll cost" value={naira(Math.round(monthlyCost))} tone="sun" hint="Gross pay + employer pension" />
        <Stat label="Take-home total" value={naira(Math.round(monthlyNet))} tone="brand" />
        <Stat label="People" value={String(team.length)} hint={`${staff} staff · ${team.length - staff} contractor${team.length - staff === 1 ? "" : "s"}`} />
        <Stat label="Next pay day" value={formatDate(payDateFor(nextPeriod, business.payDay), { day: "numeric", month: "short" })} hint={`Pay day is the ${business.payDay}th`} />
      </div>

      <Panel className="mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="text-lg">{periodLabel(nextPeriod)} payroll</h2>
          <p className="text-muted">
            {nextRun ? (nextRun.status === "PAID" ? "Paid." : "Draft ready. Check it, pay from your bank, then mark it paid.") : `${team.length} people, about ${naira(Math.round(monthlyNet))} to pay out.`}
          </p>
        </div>
        {nextRun ? (
          <ButtonLink href={`/app/payroll/runs/${nextRun.id}`}>Open {periodLabel(nextPeriod).split(" ")[0]} payroll</ButtonLink>
        ) : (
          <form action={createPayRun}>
            <input type="hidden" name="period" value={nextPeriod} />
            <SubmitButton pendingText="Working it out…">Run {periodLabel(nextPeriod).split(" ")[0]} payroll</SubmitButton>
          </form>
        )}
      </Panel>

      <Notice tone="info" className="mt-4">
        PAYE uses the 2026 tax bands (first ₦800,000 a year tax-free), 8% employee and 10% employer pension, and rent relief where declared. Check the figures with your accountant before your first run.
      </Notice>

      {runs.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-lg">Past pay runs</h2>
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/app/payroll/runs/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-canvas sm:px-5">
                  <div>
                    <p className="font-semibold">{periodLabel(r.period)}</p>
                    <p className="text-sm text-muted">Paid out {naira(r.net)} · PAYE {naira(r.paye)}</p>
                  </div>
                  <Badge tone={r.status === "PAID" ? "brand" : "sun"}>{r.status === "PAID" ? "Paid" : "Draft"}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
