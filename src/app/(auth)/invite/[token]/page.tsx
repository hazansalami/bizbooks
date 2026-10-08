import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { acceptInvite, inviteDetails } from "@/app/actions/team";
import { buttonClass } from "@/components/ui";
import { InviteSignupForm } from "../../auth-forms";

export const metadata: Metadata = { title: "Accountant invitation", robots: { index: false, follow: false } };

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, user] = await Promise.all([inviteDetails(token), getCurrentUser()]);
  if (!invite) {
    return (
      <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
        <h1 className="text-2xl">This invitation has expired</h1>
        <p className="mt-3 text-ink-soft">Invitations work once, for 7 days. Ask the business owner to send a new one from Settings → Your accountant.</p>
        {user && <Link href="/accountant" className={buttonClass("secondary", "md", "mt-5")}>Your businesses</Link>}
      </div>
    );
  }
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand">Accountant access</p>
      <h1 className="mt-1 text-2xl sm:text-3xl">Open the books of {invite.business}</h1>
      <p className="mt-3 text-ink-soft">You&apos;ll see invoices, payments, expenses, payroll and tax reports, and can work in them under your own login. Billing and the company&apos;s bank details stay with the owner.</p>
      {user ? (
        <div className="mt-6 space-y-3">
          <form action={acceptInvite}>
            <input type="hidden" name="token" value={token} />
            <button className={buttonClass("primary", "lg", "w-full")}>Accept as {user.email}</button>
          </form>
          {user.email.toLowerCase() !== invite.email && <p className="text-sm text-muted">The invitation was sent to {invite.email}. Accepting gives access to the account you&apos;re signed in with.</p>}
        </div>
      ) : (
        <>
          <div className="mt-6"><InviteSignupForm token={token} email={invite.email} /></div>
          <p className="mt-5 text-center text-sm text-muted">
            Already use BizBooks? <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-semibold text-brand hover:underline">Log in to accept</Link>
          </p>
        </>
      )}
    </div>
  );
}
