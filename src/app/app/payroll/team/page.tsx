import Link from "next/link";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { naira } from "@/lib/money";
import { computePay } from "@/lib/payroll";
import { initials } from "@/lib/utils";
import { setEmployeeStatus } from "@/app/actions/payroll";
import { Badge, ButtonLink, buttonClass, PageHeader } from "@/components/ui";

export const metadata = { title: "Team" };

export default async function Team() {
  const { business } = await requireBusiness();
  const people = await db.employee.findMany({ where: { businessId: business.id }, orderBy: [{ status: "asc" }, { fullName: "asc" }] });
  return (
    <>
      <PageHeader title="Team" back={{ href: "/app/payroll", label: "Payroll" }} actions={<ButtonLink href="/app/payroll/team/new">Add team member</ButtonLink>} />
      {people.length === 0 ? <p className="text-muted">Nobody yet.</p> : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {people.map((e) => {
            const p = computePay(e);
            return (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-wash text-sm font-bold text-brand-deep">{initials(e.fullName)}</span>
                <Link href={`/app/payroll/team/${e.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.fullName} {e.status === "LEFT" && <Badge>Left</Badge>}</p>
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
