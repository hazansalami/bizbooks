import { InstallLink, InstallNudge } from "@/components/pwa";
import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand";
import { BottomNav, SideNav } from "@/components/app-nav";
import { Badge } from "@/components/ui";
import { requireBusiness } from "@/lib/auth";
import { adminEmails } from "@/lib/admin";
import { logout } from "@/app/actions/auth";
import { isPro, isTrial } from "@/lib/plan";
import { daysBetween, initials } from "@/lib/utils";

export const metadata: Metadata = { robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, business } = await requireBusiness();
  const pro = isPro(business);
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="no-print sticky top-0 hidden h-dvh flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Logo href="/app" className="mb-6 px-2" />
        <SideNav />
        <div className="mt-auto rounded-xl bg-canvas p-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-sm font-bold text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {business.logo ? <img src={business.logo} alt="" className="size-full bg-white object-contain" /> : initials(business.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{business.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Link href="/app/settings/billing"><Badge tone={pro ? "brand" : "neutral"}>{pro ? (isTrial(business) ? `Pro trial · ${Math.max(0, daysBetween(new Date(), business.proUntil!))}d` : "Pro") : "Free plan"}</Badge></Link>
            <InstallLink />
            {adminEmails().includes(user.email.toLowerCase()) && <Link href="/admin" className="text-xs font-semibold text-brand hover:underline">Admin</Link>}
            <form action={logout}>
              <button className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-muted hover:text-ink">
                <LogOut className="size-3.5" aria-hidden /> Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:hidden">
          <Logo href="/app" />
          <Link href="/app/settings" className="grid size-10 place-items-center overflow-hidden rounded-full bg-brand text-sm font-bold text-white" aria-label="Business settings">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {business.logo ? <img src={business.logo} alt="" className="size-full bg-white object-contain" /> : initials(business.name)}
          </Link>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pt-10">{children}</main>
      </div>
      <BottomNav />
      <InstallNudge variant="app" />
    </div>
  );
}
