import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { STEPS, STEP_LABELS, type Step } from "@/lib/onboarding-steps";
import { BankStep, BrandStep, BusinessStep, PaymentsStep, TaxStep } from "./steps";
import { PLATFORM_FEE, listBanks, paymentsEnabled } from "@/lib/platform-payments";
import { naira } from "@/lib/money";

export const metadata: Metadata = { title: "Set up your business", robots: { index: false } };

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireUser();
  const b = user.ownBusiness;
  const { step: requested } = await searchParams;

  // No business yet: always start at step one. Otherwise resume at the requested step or where they left off.
  let step: Step = "business";
  if (b) {
    const resume = STEPS[Math.min(b.onboardingStep, STEPS.length - 1)];
    step = requested && (STEPS as readonly string[]).includes(requested) ? (requested as Step) : resume;
    if (!requested && b.onboardingStep >= STEPS.length) redirect("/onboarding/done");
  }
  const index = STEPS.indexOf(step);
  const first = user.fullName.split(" ")[0];

  return (
    <div className="pt-4">
      <div className="mb-8">
        <p className="text-sm font-semibold text-muted">
          Step {index + 1} of {STEPS.length} · {STEP_LABELS[step]}
        </p>
        <div className="mt-2 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1} aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= index ? "bg-brand" : "bg-line"}`} />
          ))}
        </div>
      </div>

      {step === "business" && (
        <BusinessStep
          greeting={b ? undefined : `Welcome, ${first}.`}
          defaults={{
            name: b?.name ?? "", entityType: b?.entityType ?? "LTD", rcNumber: b?.rcNumber ?? "", teamSize: b?.teamSize ?? "", industry: b?.industry ?? "",
            phone: b?.phone ?? user.phone ?? "", email: b?.email ?? user.email, state: b?.state ?? "", city: b?.city ?? "",
          }}
        />
      )}
      {step === "bank" && <BankStep />}
      {step === "payments" && <PaymentsStep bizbooks={b && paymentsEnabled() ? {
        banks: await listBanks(), hasRc: !!b.rcNumber, account: null,
        fee: { amount: naira(PLATFORM_FEE.amount), freeBelow: naira(PLATFORM_FEE.freeBelow), paystack: "1.5% + ₦100, capped at ₦2,000" },
      } : undefined} />}
      {step === "tax" && <TaxStep defaults={{ vatRegistered: b?.vatRegistered ?? false, tin: b?.tin ?? "", paymentTermsDays: b?.paymentTermsDays ?? 30, professionalServices: b?.professionalServices ?? false }} />}
      {step === "brand" && <BrandStep businessName={b?.name ?? ""} defaults={{ logo: b?.logo ?? "", brandColor: b?.brandColor ?? "#0E7A55" }} />}
    </div>
  );
}
