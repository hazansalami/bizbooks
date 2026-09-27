import Link from "next/link";
import { Check } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/constants";
import { naira } from "@/lib/money";
import { inGracePeriod, isPro, renewalPrice } from "@/lib/plan";
import { formatDate } from "@/lib/utils";
import { resumeFromPause, startUpgrade, undoCancel } from "@/app/actions/billing";
import { Badge, buttonClass, Notice, PageHeader, Panel } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";

export const metadata = { title: "Your plan" };

const MESSAGES: Record<string, { tone: "brand" | "danger" | "sun"; text: string }> = {
  upgraded: { tone: "brand", text: "Payment received. Pro is on. Automatic reminders and unlimited recurring invoices are ready." },
  discount: { tone: "brand", text: `Done. Your next renewals are discounted. Thank you for staying.` },
  pause: { tone: "brand", text: "Your plan is paused. We've kept everything, and your paid time won't run down while you're away." },
  help: { tone: "brand", text: "Thanks for telling us. Someone from our team will reach out on WhatsApp or email within one working day." },
  free: { tone: "brand", text: "You'll move to the Free plan when your paid time ends. Everything you've recorded stays." },
  cancelled: { tone: "sun", text: "Pro won't renew. You keep Pro until the end of your paid time, then move to the Free plan. Your data stays." },
  "billing-off": { tone: "danger", text: "Upgrades aren't switched on yet for this installation." },
  checkout: { tone: "danger", text: "We couldn't open the payment page. Please try again." },
  verify: { tone: "danger", text: "We couldn't confirm that payment yet. If you were charged, it will be applied automatically, so there's no need to pay again." },
};

export default async function Billing({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { business: b } = await requireBusiness();
  const sp = await searchParams;
  const key = sp.error ?? (sp.upgraded ? "upgraded" : sp.cancelled ? "cancelled" : sp.saved);
  const msg = key ? MESSAGES[key] : null;
  const pro = isPro(b);
  const paused = !!b.pausedUntil && b.pausedUntil > new Date();
  const monthly = renewalPrice(b, 1);
  const discounted = monthly < PLANS.PRO.monthly;
  const history = await db.platformPayment.findMany({ where: { businessId: b.id, status: "PAID" }, orderBy: { paidAt: "desc" }, take: 12 });

  return (
    <>
      <PageHeader title="Your plan" back={{ href: "/app/settings", label: "Settings" }} />
      {msg && <Notice tone={msg.tone} className="mb-5">{msg.text}</Notice>}

      <Panel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Current plan</p>
            <p className="text-2xl font-bold">{pro ? "Pro" : paused ? "Pro (paused)" : "Free"}</p>
          </div>
          {pro && !b.cancelAtEnd && <Badge tone={inGracePeriod(b) ? "sun" : "brand"}>{inGracePeriod(b) ? `Ended ${formatDate(b.proUntil)}` : `Paid until ${formatDate(b.proUntil)}`}</Badge>}
          {pro && b.cancelAtEnd && <Badge tone="sun">Ends {formatDate(b.proUntil)}</Badge>}
          {paused && <Badge tone="sun">Paused until {formatDate(b.pausedUntil)}</Badge>}
        </div>

        {paused && (
          <form action={resumeFromPause} className="mt-4">
            <p className="mb-3 text-ink-soft">Pro features are off while paused. Your paid time is saved and resumes automatically on {formatDate(b.pausedUntil)}.</p>
            <SubmitButton>Resume Pro now</SubmitButton>
          </form>
        )}
        {pro && b.cancelAtEnd && (
          <form action={undoCancel} className="mt-4">
            <p className="mb-3 text-ink-soft">You won't get renewal reminders, and you'll move to Free after {formatDate(b.proUntil)}.</p>
            <SubmitButton variant="secondary">Keep Pro after all</SubmitButton>
          </form>
        )}
      </Panel>

      {!paused && (
        <Panel className="mt-5 p-5 sm:p-6">
          <h2 className="text-lg">{pro ? "Renew or extend Pro" : "Upgrade to Pro"}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {PLANS.PRO.features.slice(1).map((f) => <li key={f} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />{f}</li>)}
          </ul>
          {discounted && <Notice tone="brand" className="mt-4">Your {b.discountPercent}% discount applies to monthly renewals until {formatDate(b.discountUntil)}.</Notice>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form action={startUpgrade} className="rounded-xl border border-line p-4">
              <input type="hidden" name="months" value="1" />
              <p className="font-semibold">Monthly</p>
              <p className="num mt-1 text-2xl font-bold">{naira(monthly)}{discounted && <span className="ml-2 text-base font-normal text-muted line-through">{naira(PLANS.PRO.monthly)}</span>}</p>
              <SubmitButton variant="secondary" className="mt-3 w-full" pendingText="Opening Paystack…">Pay for 1 month</SubmitButton>
            </form>
            <form action={startUpgrade} className="rounded-xl border-2 border-brand p-4">
              <input type="hidden" name="months" value="12" />
              <p className="font-semibold">Yearly <Badge tone="sun">2 months free</Badge></p>
              <p className="num mt-1 text-2xl font-bold">{naira(PLANS.PRO.yearly)}</p>
              <SubmitButton className="mt-3 w-full" pendingText="Opening Paystack…">Pay for 12 months</SubmitButton>
            </form>
          </div>
          <p className="mt-3 text-sm text-muted">Pay by card, transfer or USSD. We never charge you automatically. We'll remind you a week before your plan ends.</p>
        </Panel>
      )}

      {history.length > 0 && (
        <Panel className="mt-5 p-5">
          <h2 className="text-lg">Payment history</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {history.map((h) => <li key={h.id} className="flex justify-between py-2"><span>{formatDate(h.paidAt)} · {h.months} month{h.months > 1 ? "s" : ""}</span><span className="num font-semibold">{naira(h.amount)}</span></li>)}
          </ul>
        </Panel>
      )}

      {pro && !b.cancelAtEnd && (
        <p className="mt-8 text-center text-sm">
          <Link href="/app/settings/billing/cancel" className={buttonClass("ghost", "sm", "text-muted")}>Cancel Pro</Link>
        </p>
      )}
    </>
  );
}
