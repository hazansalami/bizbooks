import { InstallNudge } from "@/components/pwa";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui";
import { MobileMenu, SolutionsMenu } from "@/components/site-nav";
import { getCurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/constants";
import { SOLUTIONS, SOLUTION_GROUPS } from "./solutions/data";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-paper focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Logo />
            <nav aria-label="Main" className="flex items-center gap-1">
              <SolutionsMenu />
              <Link href="/insights" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink md:inline-flex">Resources</Link>
              <Link href="/tools" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink lg:inline-flex">Calculators</Link>
              <Link href="/advisors" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink lg:inline-flex">Advisors</Link>
              <Link href="/pricing" className="hidden min-h-11 items-center rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink md:inline-flex">Pricing</Link>
            </nav>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <ButtonLink href="/app" size="sm">Open dashboard</ButtonLink>
            ) : (
              <>
                <Link href="/login" className="hidden min-h-11 items-center whitespace-nowrap rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink sm:inline-flex">Log in</Link>
                <ButtonLink href="/signup" size="sm">Start free</ButtonLink>
              </>
            )}
            <MobileMenu signedIn={!!user} />
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">
              Accounting, invoicing, payroll and tax tracking for Nigerian companies. Clients pay you directly; {APP_NAME} never holds your money.
            </p>
          </div>
          {SOLUTION_GROUPS.map((g) => (
            <div key={g}>
              <p className="text-sm font-semibold">{g}</p>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                {SOLUTIONS.filter((s) => s.group === g).map((s) => <li key={s.slug}><Link href={`/solutions/${s.slug}`} className="hover:text-ink">{s.name}</Link></li>)}
                {g === "Pay your team" && <><li><Link href="/advisors" className="hover:text-ink">Advisors</Link></li><li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li></>}
              </ul>
            </div>
          ))}
          <div>
            <p className="text-sm font-semibold">Resources</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li><Link href="/insights" className="hover:text-ink">Insights</Link></li>
              <li><Link href="/insights/nigeria-tax-calendar-2026" className="hover:text-ink">Tax calendar 2026</Link></li>
              <li><Link href="/install" className="hover:text-ink">Get the app</Link></li>
              <li><Link href="/tools" className="hover:text-ink">Free calculators</Link></li>
              <li><Link href="/tools/paye-calculator" className="hover:text-ink">PAYE calculator</Link></li>
              <li><Link href="/tools/company-income-tax-calculator" className="hover:text-ink">Company tax calculator</Link></li>
              <li><Link href="/insights/business-finance-glossary-nigeria" className="hover:text-ink">Glossary</Link></li>
              <li><Link href="/compare/zoho-books" className="hover:text-ink">BizBooks vs Zoho Books</Link></li>
              <li><Link href="/compare/wave" className="hover:text-ink">BizBooks vs Wave</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line py-5 text-center text-xs text-muted">
          <p>© {new Date().getFullYear()} {APP_NAME}. Built in Nigeria, for Nigerian companies.</p>
          <p className="mt-2 flex justify-center gap-4"><Link href="/terms" className="hover:text-ink">Terms of Service</Link><Link href="/privacy" className="hover:text-ink">Privacy Policy</Link></p>
          <p className="mx-auto mt-2 max-w-2xl px-4">Guides and calculators are general information, not tax, legal or financial advice. Always confirm with a qualified professional.</p>
        </div>
      </footer>
      <InstallNudge variant="site" />
    </>
  );
}
