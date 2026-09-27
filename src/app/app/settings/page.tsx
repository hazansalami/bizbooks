import Link from "next/link";
import { ChevronRight, CreditCard, Landmark } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { PageHeader } from "@/components/ui";
import { ProfileForm } from "@/components/settings-forms";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { business: b } = await requireBusiness();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {[
          ["/app/settings/payments", Landmark, "How you get paid", "Bank accounts, Paystack and Flutterwave"],
          ["/app/settings/billing", CreditCard, "Your plan", isPro(b) ? "Pro" : "Free plan"],
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
        p={{
          name: b.name, legalName: b.legalName ?? "", rcNumber: b.rcNumber ?? "", entityType: b.entityType, professionalServices: b.professionalServices, payDay: b.payDay,
          email: b.email ?? "", phone: b.phone ?? "", address: b.address ?? "", city: b.city ?? "", state: b.state ?? "", tin: b.tin ?? "",
          vatRegistered: b.vatRegistered, vatRate: b.vatRate, invoicePrefix: b.invoicePrefix, paymentTermsDays: b.paymentTermsDays,
          invoiceFooter: b.invoiceFooter ?? "", autoReminders: b.autoReminders, logo: b.logo ?? "", brandColor: b.brandColor,
        }}
      />
    </>
  );
}
