import { requireOwner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { cancelInvite, removeMember } from "@/app/actions/team";
import { PageHeader, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { InviteForm } from "@/components/team-bits";

export const metadata = { title: "Your accountant" };

export default async function Team() {
  const { business } = await requireOwner();
  const [members, invites] = await Promise.all([
    db.membership.findMany({ where: { businessId: business.id }, include: { user: { select: { fullName: true, email: true, lastSeenAt: true } } }, orderBy: { createdAt: "asc" } }),
    db.businessInvite.findMany({ where: { businessId: business.id, acceptedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return (
    <>
      <PageHeader title="Your accountant" back={{ href: "/app/settings", label: "Settings" }} description="Give your accountant their own login instead of sharing yours or emailing spreadsheets every month." />
      <Panel className="p-5 sm:p-6">
        <h2 className="text-lg">Invite your accountant</h2>
        <p className="mb-4 mt-1 text-sm text-ink-soft">They can see and work in your invoices, expenses, payroll, bank lines and tax reports. They can&apos;t change your plan, the bank accounts clients pay into, payment gateways, staff bank details, or who has access.</p>
        <InviteForm />
      </Panel>

      {(members.length > 0 || invites.length > 0) && (
        <ul className="mt-5 divide-y divide-line rounded-2xl border border-line bg-paper">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.user.fullName}</p>
                <p className="text-sm text-muted">{m.user.email} · Accountant since {formatDate(m.createdAt)}</p>
              </div>
              <form action={removeMember}><input type="hidden" name="id" value={m.id} />
                <ConfirmButton message={`Remove ${m.user.fullName}'s access to ${business.name}?`} className="text-sm font-semibold text-danger hover:underline">Remove access</ConfirmButton>
              </form>
            </li>
          ))}
          {invites.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.email}</p>
                <p className="text-sm text-muted">Invited {formatDate(i.createdAt)} · link works until {formatDate(i.expiresAt)}</p>
              </div>
              <form action={cancelInvite}><input type="hidden" name="id" value={i.id} />
                <button className="text-sm font-semibold text-muted hover:text-ink hover:underline">Cancel invitation</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
