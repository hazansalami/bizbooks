import Link from "next/link";
import { CheckCircle2, Circle, Gift } from "lucide-react";
import { TRIAL } from "@/lib/constants";
import { isTrial } from "@/lib/plan";
import { buttonClass } from "./ui";
import { cn, daysBetween, formatDate } from "@/lib/utils";

const HREF: Record<string, string> = {
  FIRST_INVOICE: "/app/invoices/new",
  GET_PAID: "/app/settings/payments",
  PAYROLL_OR_IMPORT: "/app/payroll",
};

type TrialBusiness = { plan: string; proUntil: Date | null; pausedUntil: Date | null; discountPercent: number; discountUntil: Date | null; trialEndsAt: Date | null; trialBonuses: string[] };

/** The Pro trial, on the dashboard: days left, and the steps that each add a week. */
export function TrialCard({ business }: { business: TrialBusiness }) {
  if (!isTrial(business) || !business.proUntil || business.proUntil < new Date()) return null;
  const left = Math.max(0, daysBetween(new Date(), business.proUntil));
  const done = new Set(business.trialBonuses);
  const earnable = TRIAL.bonuses.filter((b) => !done.has(b.key)).length * TRIAL.bonusDays;

  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-wash/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-deep">Pro trial</p>
          <h2 className="mt-1 text-xl">
            {left} day{left === 1 ? "" : "s"} of Pro left
            {earnable > 0 && <span className="font-normal text-ink-soft">, earn up to {earnable} more</span>}
          </h2>
          <p className="text-sm text-ink-soft">Every Pro feature until {formatDate(business.proUntil)}. After that you keep your books on the Free plan; nothing is deleted.</p>
        </div>
        <Link href="/app/settings/billing" className={buttonClass("secondary", "sm")}>Keep Pro</Link>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        {TRIAL.bonuses.map((b) => {
          const ok = done.has(b.key);
          return (
            <li key={b.key}>
              <Link href={HREF[b.key]} className={cn("flex h-full items-start gap-2 rounded-xl border bg-paper p-3 text-sm", ok ? "border-brand/30" : "border-line hover:border-ink")}>
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                <span>
                  <span className={cn("block font-semibold", ok && "text-ink-soft line-through decoration-brand/40")}>{b.label}</span>
                  <span className="text-xs text-muted">{ok ? `+${TRIAL.bonusDays} days added` : `+${TRIAL.bonusDays} days of Pro${b.key === "GET_PAID" ? ` (+${TRIAL.paymentsBonusFeeFree} fee-free payments with BizBooks Payments)` : ""}`}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 flex items-center gap-2 text-sm text-ink-soft">
        <Gift className="size-4 text-brand" aria-hidden />
        Know another business? <Link href="/app/refer" className="font-semibold text-brand-deep hover:underline">Give them {TRIAL.referredDays} days free and earn 3 months of Pro</Link>
      </p>
    </section>
  );
}
