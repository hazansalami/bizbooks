import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle, PauseCircle, Percent } from "lucide-react";
import { saveOfferAllowed } from "@/lib/billing";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPro } from "@/lib/plan";
import { naira } from "@/lib/money";
import { CANCEL_REASONS, MAX_PAUSE_MONTHS, PLANS, SAVE_OFFER_DISCOUNT, SAVE_OFFER_MONTHS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { acceptSaveOffer, cancelReason, confirmCancel } from "@/app/actions/billing";
import { buttonClass, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";

export const metadata = { title: "Cancel Pro" };

/*
  Cancel flow: one-question survey → one offer matched to the reason → clear confirmation.
  "Continue cancelling" is always visible; no guilt-trip copy.
*/
export default async function CancelFlow({ searchParams }: { searchParams: Promise<{ step?: string; reason?: string; details?: string }> }) {
  const { business: b } = await requireBusiness();
  if (!isPro(b) || b.cancelAtEnd) redirect("/app/settings/billing");
  const { step = "reason", reason = "", details = "" } = await searchParams;
  const [invoiceCount, recurring] = await Promise.all([
    db.invoice.count({ where: { businessId: b.id } }),
    db.recurringSchedule.count({ where: { businessId: b.id, status: "ACTIVE" } }),
  ]);
  const hidden = (<><input type="hidden" name="reason" value={reason} /><input type="hidden" name="details" value={details} /></>);
  const saving = Math.round(PLANS.PRO.monthly * (SAVE_OFFER_DISCOUNT / 100));
  const cont = `/app/settings/billing/cancel?${new URLSearchParams({ step: "confirm", reason, details })}`;

  if (step === "offer") {
    const offer = ["TOO_EXPENSIVE", "SWITCHING"].includes(reason) ? "DISCOUNT"
      : ["NOT_USING", "SEASONAL"].includes(reason) ? "PAUSE"
      : ["TECHNICAL", "MISSING_FEATURE"].includes(reason) ? "HELP" : null;
    // Skip offers this business can't take (trials, or one already used) rather than offering and refusing.
    if (!offer || ((offer === "DISCOUNT" || offer === "PAUSE") && !(await saveOfferAllowed(b, offer)))) redirect(cont);
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Before you go" />
        {offer === "DISCOUNT" && (
          <Panel className="p-6">
            <Percent className="size-8 text-brand" aria-hidden />
            <h2 className="mt-3 text-xl">Keep Pro for {naira(PLANS.PRO.monthly - saving)} a month</h2>
            <p className="mt-2 text-ink-soft">That's {SAVE_OFFER_DISCOUNT}% off, which saves you {naira(saving)} a month for your next {SAVE_OFFER_MONTHS} monthly renewals. Your reminders and {recurring > 0 ? `${recurring} recurring invoice${recurring > 1 ? "s" : ""}` : "recurring invoices"} keep running.</p>
            <form action={acceptSaveOffer} className="mt-5">{hidden}<input type="hidden" name="offer" value="DISCOUNT" /><SubmitButton size="lg" className="w-full">Yes, apply the discount</SubmitButton></form>
            <form action={acceptSaveOffer} className="mt-3">{hidden}<input type="hidden" name="offer" value="FREE" />
              <button className={buttonClass("secondary", "lg", "w-full")}>Switch to the Free plan instead</button>
            </form>
          </Panel>
        )}
        {offer === "PAUSE" && (
          <Panel className="p-6">
            <PauseCircle className="size-8 text-brand" aria-hidden />
            <h2 className="mt-3 text-xl">Pause instead of cancelling</h2>
            <p className="mt-2 text-ink-soft">Take a break for up to {MAX_PAUSE_MONTHS} months. Your paid time stops running down, your {invoiceCount} invoices and customers stay exactly as they are, and Pro switches back on by itself.</p>
            <form action={acceptSaveOffer} className="mt-5 space-y-3">{hidden}<input type="hidden" name="offer" value="PAUSE" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: MAX_PAUSE_MONTHS }, (_, i) => i + 1).map((m) => (
                  <label key={m} className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-line-strong text-sm font-semibold has-[:checked]:border-brand has-[:checked]:bg-brand-wash has-[:checked]:text-brand-deep">
                    <input type="radio" name="months" value={m} defaultChecked={m === 1} className="sr-only" />{m} month{m > 1 ? "s" : ""}
                  </label>
                ))}
              </div>
              <SubmitButton size="lg" className="w-full">Pause my plan</SubmitButton>
            </form>
          </Panel>
        )}
        {offer === "HELP" && (
          <Panel className="p-6">
            <MessageCircle className="size-8 text-brand" aria-hidden />
            <h2 className="mt-3 text-xl">{reason === "TECHNICAL" ? "Let us fix it for you" : "Tell us what you need"}</h2>
            <p className="mt-2 text-ink-soft">
              {reason === "TECHNICAL"
                ? "Something not working is on us. A real person will contact you within one working day to sort it out."
                : "We build what Nigerian businesses ask for. Tell us what's missing and we'll tell you honestly whether it's coming, and when."}
            </p>
            {details && <p className="mt-3 rounded-xl bg-canvas p-3 text-sm italic">“{details}”</p>}
            <form action={acceptSaveOffer} className="mt-5">{hidden}<input type="hidden" name="offer" value="HELP" /><SubmitButton size="lg" className="w-full">Yes, contact me</SubmitButton></form>
          </Panel>
        )}
        <p className="mt-5 text-center"><Link href={cont} className="inline-flex min-h-11 items-center font-semibold text-muted underline hover:text-ink">No thanks, continue cancelling</Link></p>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Confirm cancellation" />
        <Panel className="p-6">
          {reason === "CLOSED" && <p className="mb-4 text-ink-soft">We're sorry to hear that. Running a business in Nigeria takes courage, and we hope to see you again.</p>}
          <h2 className="text-lg">Here's what happens</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>You keep Pro until <strong className="text-ink">{formatDate(b.proUntil)}</strong>. Nothing is charged, because we never charge automatically.</li>
            <li>After that you're on the Free plan. Your invoices, customers, payments and reports all stay.</li>
            <li>Automatic reminders stop{recurring > 2 ? `, and only 2 of your ${recurring} recurring invoices keep running` : ""}.</li>
            <li>You can come back to Pro any time with one payment.</li>
          </ul>
          <form action={confirmCancel} className="mt-6 flex flex-col gap-3 sm:flex-row">
            {hidden}
            <SubmitButton variant="danger" size="lg">Cancel Pro</SubmitButton>
            <Link href="/app/settings/billing" className={buttonClass("secondary", "lg")}>Keep Pro</Link>
          </form>
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Cancel Pro" description="Help us get better: what's the main reason?" back={{ href: "/app/settings/billing", label: "Your plan" }} />
      <form action={cancelReason}>
        <Panel className="p-5 sm:p-6">
          <fieldset>
            <legend className="sr-only">Main reason for cancelling</legend>
            <div className="space-y-2">
              {CANCEL_REASONS.map((r, i) => (
                <label key={r.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 has-[:checked]:border-brand has-[:checked]:bg-brand-wash">
                  <input type="radio" name="reason" value={r.value} required defaultChecked={i === 0} className="size-4 accent-brand" />{r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="details" className="mt-5 block text-sm font-semibold">Anything else you'd like to tell us? <span className="font-normal text-muted">(optional)</span></label>
          <textarea id="details" name="details" rows={3} className="mt-1.5 w-full rounded-xl border border-line-strong p-3 focus:border-brand focus:outline-none" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <SubmitButton size="lg">Continue</SubmitButton>
            <Link href="/app/settings/billing" className={buttonClass("secondary", "lg")}>Never mind, keep Pro</Link>
          </div>
        </Panel>
      </form>
    </div>
  );
}
