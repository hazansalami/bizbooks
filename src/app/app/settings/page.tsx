import Link from "next/link";
import { ChevronRight, CreditCard, Landmark, LogOut, Palette, Upload, UserPlus } from "lucide-react";
import { INVOICE_TEMPLATES, templateId } from "@/lib/invoice-templates";
import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { whatsappConfigured } from "@/lib/whatsapp";
import { Badge, buttonClass, Notice, PageHeader, Panel } from "@/components/ui";
import { ConfirmButton } from "@/components/form-bits";
import { signOutEverywhere } from "@/app/actions/auth";
import { ProfileForm } from "@/components/settings-forms";

export const metadata = { title: "Settings" };

export default async function Settings({ searchParams }: { searchParams: Promise<{ signedOut?: string }> }) {
  const { user, business: b } = await requireBusiness();
  const { signedOut } = await searchParams;
  return (
    <>
      <PageHeader title="Settings" />
      {user.role !== "OWNER" && (
        <Notice className="mb-5" title={`You're working in ${b.name} as their accountant`}>
          Billing, the bank accounts clients pay into, payment gateways and who has access are kept for the owner.
        </Notice>
      )}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ...(user.role === "OWNER" ? [
            ["/app/settings/payments", Landmark, "How you get paid", "Bank accounts, Paystack and Flutterwave"],
            ["/app/settings/billing", CreditCard, "Your plan", isPro(b) ? "Pro" : "Free plan"],
            ["/app/settings/team", UserPlus, "Your accountant", "Give your accountant their own login"],
          ] : []),
          ["/app/settings/invoice-style", Palette, "Invoice style", `${INVOICE_TEMPLATES.find((t) => t.id === templateId(b.invoiceTemplate))!.name} · 5 styles to choose from`],
          ["/app/import", Upload, "Import from Wave or Zoho Books", "Clients, invoices and services from a CSV export"],
        ].map(([href, Icon, title, sub]) => {
          const I = Icon as typeof Landmark;
          return (
            <Link key={href as string} href={href as string} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 hover:border-ink">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-wash text-brand"><I className="size-5" aria-hidden /></span>
              <span className="flex-1"><span className="block font-semibold">{title as string}</span><span className="text-sm text-muted">{sub as string}</span></span>
              <ChevronRight className="size-4 text-muted" aria-hidden />
            </Link>
          );
        })}
      </div>
      <ProfileForm
        pro={isPro(b)}
        whatsappReady={whatsappConfigured()}
        p={{
          name: b.name, legalName: b.legalName ?? "", rcNumber: b.rcNumber ?? "", entityType: b.entityType, professionalServices: b.professionalServices, payDay: b.payDay,
          email: b.email ?? "", phone: b.phone ?? "", address: b.address ?? "", city: b.city ?? "", state: b.state ?? "", tin: b.tin ?? "",
          vatRegistered: b.vatRegistered, vatRate: b.vatRate, invoicePrefix: b.invoicePrefix, paymentTermsDays: b.paymentTermsDays,
          invoiceFooter: b.invoiceFooter ?? "", autoReminders: b.autoReminders, whatsappReminders: b.whatsappReminders, logo: b.logo ?? "", brandColor: b.brandColor,
        }}
      />

      <Panel className="mt-6 p-5 sm:p-6">
        <h2 className="text-lg">Your account</h2>
        {signedOut && <Notice tone="brand" className="mt-3">Done. Every other device has been signed out; this one stays signed in.</Notice>}
        <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted">Sign-in email</dt>
          <dd>{user.email} {user.emailVerifiedAt ? <Badge tone="brand">Confirmed</Badge> : <Link href="/verify-email?next=/app/settings" className="font-semibold text-brand underline">Confirm it</Link>}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/forgot-password" className={buttonClass("secondary", "sm")}>Change password</Link>
          <form action={signOutEverywhere}>
            <ConfirmButton message="Sign out of BizBooks on every other phone and computer? You'll stay signed in here." className={buttonClass("secondary", "sm")}>
              <LogOut className="size-4" aria-hidden /> Sign out of all other devices
            </ConfirmButton>
          </form>
        </div>
        <p className="mt-2 text-sm text-muted">Use this if you signed in on a shared or lost device, or think someone else has access to your account.</p>
      </Panel>
    </>
  );
}
