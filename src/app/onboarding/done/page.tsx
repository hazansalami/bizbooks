import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "You're ready", robots: { index: false } };

export default async function Done() {
  const user = await requireUser();
  const b = user.business;
  if (!b) redirect("/onboarding");
  if (!b.onboardedAt) await db.business.update({ where: { id: b.id }, data: { onboardedAt: new Date() } });
  const [banks, gateways] = await Promise.all([
    db.bankAccount.count({ where: { businessId: b.id } }),
    db.gateway.count({ where: { businessId: b.id, enabled: true } }),
  ]);

  return (
    <div className="pt-8 text-center">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-sun-wash text-sun-ink"><PartyPopper className="size-8" aria-hidden /></span>
      <h1 className="mt-5 text-3xl sm:text-4xl">{b.name} is ready to get paid.</h1>
      <p className="mx-auto mt-3 max-w-md text-lg text-ink-soft">
        {gateways ? "Your invoices will have a “Pay now” button. " : banks ? "Your invoices will show your bank details. " : ""}
        The fastest way to see how it works is to send your first invoice. You can even send one to yourself.
      </p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <ButtonLink href="/app/invoices/new" size="lg">Create my first invoice</ButtonLink>
        <ButtonLink href="/app" size="lg" variant="secondary">Go to my dashboard</ButtonLink>
      </div>
      <p className="mt-6 text-ink-soft">
        Coming from Wave or Zoho Books? <Link href="/app/import" className="font-semibold text-brand hover:underline">Import your clients, invoices and retainers</Link> in a few minutes.
      </p>
      {(!banks || !gateways) && (
        <p className="mt-6 text-sm text-muted">
          Skipped something? No problem. Your dashboard has a checklist to finish it whenever you're ready.
        </p>
      )}
    </div>
  );
}
