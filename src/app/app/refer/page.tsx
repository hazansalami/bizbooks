import { Gift, Mail, MessageCircle, Sparkles } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { db } from "@/lib/db";
import { isPaidPro, isPro } from "@/lib/plan";
import { siteUrl } from "@/lib/site-url";
import { REFERRAL, TRIAL, LIFETIME_PRO_UNTIL } from "@/lib/constants";
import { setReferralFooter } from "@/app/actions/referrals";
import { Badge, buttonClass, PageHeader, Panel } from "@/components/ui";
import { CopyButton } from "@/components/form-bits";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Refer & earn" };

const STATUS: Record<string, { label: string; tone: "brand" | "sun" | "neutral" | "danger" }> = {
  PENDING: { label: "Signed up", tone: "sun" },
  QUALIFIED: { label: "Reward earned", tone: "brand" },
  REVIEW: { label: "Being checked", tone: "sun" },
  REJECTED: { label: "Not eligible", tone: "danger" },
  EXPIRED: { label: "Didn't get started", tone: "neutral" },
};

export default async function ReferPage() {
  const { business } = await requireBusiness();
  const referrals = await db.referral.findMany({ where: { referrerId: business.id }, orderBy: { createdAt: "desc" }, include: { referred: { select: { name: true, createdAt: true } } } });
  const link = new URL(`/r/${business.referralCode}`, siteUrl()).toString();
  const qualified = referrals.filter((r) => r.status === "QUALIFIED").length;
  const next = REFERRAL.milestones.find((m) => m.count > qualified);
  const lifetime = !!business.proUntil && business.proUntil >= LIFETIME_PRO_UNTIL;
  const monthsEarned = referrals.reduce((s, r) => s + r.rewardMonths, 0);
  const message = `I use BizBooks for invoices, payroll and tax deadlines. Clients pay by card or transfer straight to your account. Sign up with my link and get ${TRIAL.referredDays} days of Pro free: ${link}`;

  return (
    <>
      <PageHeader title="Refer & earn" description={`Give ${TRIAL.referredDays} days of Pro. Get ${REFERRAL.rewardMonths} months of Pro and ${REFERRAL.rewardFeeFree} fee-free payments for every business that gets going.`} />

      <Panel className="border-brand/40 p-5 sm:p-6">
        <p className="text-sm font-semibold">Your link</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="num min-w-0 flex-1 truncate rounded-xl bg-canvas px-4 py-3 text-sm ring-1 ring-line">{link}</code>
          <CopyButton text={link} label="Copy link" />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className={buttonClass("primary", "md", "bg-[#1FAF5A] hover:bg-[#178F49]")}>
            <MessageCircle className="size-5" aria-hidden /> Share on WhatsApp
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`${TRIAL.referredDays} days of BizBooks Pro, on me`)}&body=${encodeURIComponent(message)}`} className={buttonClass("secondary")}>
            <Mail className="size-5" aria-hidden /> Share by email
          </a>
        </div>
        <p className="mt-3 text-xs text-muted">Your code is <strong className="num text-ink">{business.referralCode}</strong>. Anyone who signs up from the link on your invoices counts too.</p>
      </Panel>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-lg">How it works</h2>
          <ol className="mt-3 space-y-3 text-ink-soft">
            {[
              <>Share your link, or just keep sending invoices: the “Sent with BizBooks” line on them carries your link.</>,
              <>They get <strong className="text-ink">{TRIAL.referredDays} days of Pro free</strong>, double the usual trial.</>,
              <>Once they&apos;re up and running (they send {REFERRAL.minInvoices} invoices to {REFERRAL.minClients} or more clients and a client opens one, or they take a payment through BizBooks Payments), you get <strong className="text-ink">{REFERRAL.rewardMonths} months of Pro and {REFERRAL.rewardFeeFree} fee-free payments</strong>.</>,
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-wash text-sm font-bold text-brand-deep">{i + 1}</span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            Pro time banks up to {REFERRAL.bankCapMonths} months ahead. They need to join within 60 days of clicking your link and get going within {REFERRAL.qualifyWithinDays} days of joining.
            Referrals of your own company don&apos;t count. <a href="/terms#referrals" className="underline">Referral terms</a>
          </p>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg"><Gift className="size-5 text-brand" aria-hidden /> Your rewards</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Businesses up and running</dt><dd className="num font-bold">{qualified}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pro earned</dt><dd className="num font-bold">{lifetime ? "For life" : `${monthsEarned} month${monthsEarned === 1 ? "" : "s"}`}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Pro until</dt><dd className="num font-bold">{lifetime ? "Forever" : isPro(business) && business.proUntil ? formatDate(business.proUntil) : "Free plan"}</dd></div>
          </dl>
          {next && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Next: {next.label}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={next.count} aria-valuenow={qualified} aria-label="Progress to next milestone">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (qualified / next.count) * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted">{qualified} of {next.count}</p>
            </div>
          )}
          <ul className="mt-4 space-y-1 text-xs text-muted">
            {REFERRAL.milestones.map((m) => (
              <li key={m.count} className={cn("flex gap-2", qualified >= m.count && "font-semibold text-brand-deep")}><Sparkles className="size-3.5 shrink-0" aria-hidden />{m.count} businesses: {m.label}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel className="mt-5 p-5 sm:p-6">
        <h2 className="text-lg">Businesses you&apos;ve referred</h2>
        {referrals.length === 0 ? (
          <p className="mt-2 text-muted">None yet. Share your link on WhatsApp, or with a business you invoice.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {referrals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">{r.referred.name}</p>
                  <p className="text-sm text-muted">Joined {formatDate(r.referred.createdAt)}{r.source === "INVOICE" ? " · from your invoice" : ""}{r.status === "REJECTED" && r.reason ? ` · ${r.reason}` : ""}</p>
                </div>
                <Badge tone={STATUS[r.status]?.tone ?? "neutral"}>{r.status === "QUALIFIED" ? `+${r.rewardMonths ? `${r.rewardMonths} months` : "lifetime"}` : STATUS[r.status]?.label ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {isPaidPro(business) ? (
        <Panel className="mt-5 p-5 sm:p-6">
          <h2 className="text-lg">Your invoices</h2>
          <p className="mt-1 text-sm text-ink-soft">
            With paid Pro, your invoices carry no {`"`}Sent with BizBooks{`"`} line. Turn it back on to earn from the businesses you invoice; it&apos;s a small line at the bottom.
          </p>
          <form action={setReferralFooter} className="mt-3">
            <input type="hidden" name="on" value={business.showReferralFooter ? "0" : "1"} />
            <button className={buttonClass(business.showReferralFooter ? "secondary" : "primary", "sm")}>
              {business.showReferralFooter ? "Remove the line from my invoices" : "Add the referral line to my invoices"}
            </button>
          </form>
        </Panel>
      ) : (
        <p className="mt-5 text-sm text-muted">
          Your invoices carry a small {`"`}Sent with BizBooks{`"`} line with your referral link, so businesses you invoice can join through you.
          {isPro(business) ? " It comes off while you're on paid Pro." : " Paid Pro removes it."}
        </p>
      )}
    </>
  );
}
