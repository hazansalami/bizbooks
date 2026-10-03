import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { computePay } from "@/lib/payroll";
import { initials } from "@/lib/utils";
import { setEmployeeStatus, setPayeDefault } from "@/app/actions/payroll";
import { Badge, ButtonLink, buttonClass, Notice, PageHeader } from "@/components/ui";
import { isPro } from "@/lib/plan";
import { FREE_PAYROLL_LIMIT } from "@/lib/constants";

export const metadata = { title: "Team" };

export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { business } = await requireBusiness();
  const { error } = await searchParams;
  const people = await db.employee.findMany({ where: { businessId: business.id }, orderBy: [{ status: "asc" }, { fullName: "asc" }] });
  const active = people.filter((e) => e.status === "ACTIVE").length;
  const pro = isPro(business);
  const staff = people.filter((e) => e.status === "ACTIVE" && e.kind === "EMPLOYEE");
  const selfTax = staff.filter((e) => !e.paye).length;
  return (
    <>
      <PageHeader title="Team" back={{ href: "/app/payroll", label: "Payroll" }} actions={<ButtonLink href="/app/payroll/team/new">Add team member</ButtonLink>} />
      {error === "limit" && (
        <Notice tone="sun" className="mb-4">The Free plan runs payroll for up to {FREE_PAYROLL_LIMIT} people. Mark someone as left first, or <Link href="/app/settings/billing" className="font-semibold underline">upgrade to Pro</Link> for your whole team.</Notice>
      )}
      {!pro && active > FREE_PAYROLL_LIMIT && error !== "limit" && (
        <Notice tone="sun" className="mb-4">On the Free plan, pay runs include the first {FREE_PAYROLL_LIMIT} people you added. <Link href="/app/settings/billing" className="font-semibold underline">Upgrade to Pro</Link> to pay all {active}.</Notice>
      )}
      <form action={setPayeDefault} className="mb-5 rounded-2xl border border-line bg-paper p-4 sm:p-5">
        <fieldset>
          <legend className="font-semibold">Who handles PAYE (income tax) for your staff?</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([["company", "The company deducts and remits it", "PAYE comes off each payslip and goes on your tax calendar."], ["employee", "Each employee pays their own", "No PAYE is deducted; payslips say they handle it."]] as const).map(([val, label, sub]) => (
              <label key={val} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-wash">
                <input type="radio" name="paye" value={val} defaultChecked={(val === "company") === business.payeDefault} className="mt-1 size-4 accent-brand" />
                <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted">{sub}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {staff.length > 0 && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="applyAll" className="size-4 accent-brand" /> Apply to all {staff.length} current staff too</label>
          )}
          <button className={buttonClass("secondary", "sm")}>Save</button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Sets the default for new staff; you can change anyone on their own page.
          {selfTax > 0 && ` ${selfTax} of ${staff.length} staff currently handle their own PAYE.`}{" "}
          The Nigeria Tax Act 2025 makes employers responsible for deducting and remitting PAYE on salaries, so if it goes unpaid the tax office can recover it from the company. Check with your accountant.
        </p>
      </form>
      {people.length === 0 ? <p className="text-muted">Nobody yet.</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {people.map((e) => {
            const p = computePay(e);
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-wash text-sm font-bold text-brand-deep">{initials(e.fullName)}</span>
                <Link href={`/app/payroll/team/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.fullName} {e.status === "LEFT" && <Badge>Left</Badge>} {e.kind === "EMPLOYEE" && !e.paye && e.status !== "LEFT" && <Badge>Pays own tax</Badge>}</p>
                  <p className="truncate text-sm text-muted">{e.jobTitle ?? "—"} · {e.kind === "CONTRACTOR" ? "Contractor" : "Staff"}</p>
                </Link>
                <div className="hidden text-right sm:block">
                  <p className="num font-semibold">{naira(p.gross)}</p>
                  <p className="num text-xs text-muted">takes home {naira(p.net)}</p>
                </div>
                <form action={setEmployeeStatus}>
                  <input type="hidden" name="id" value={e.id} />
                  <button name="status" value={e.status === "LEFT" ? "ACTIVE" : "LEFT"} className={buttonClass("ghost", "sm")}>{e.status === "LEFT" ? "Rehire" : "Mark as left"}</button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
