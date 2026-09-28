import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import { Logo } from "@/components/brand";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo href="/admin" />
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-white">Admin</span>
          </div>
          <nav aria-label="Admin" className="flex flex-1 gap-1 text-sm font-semibold">
            <Link href="/admin" className="rounded-full px-3 py-2 hover:bg-canvas">Overview</Link>
            <Link href="/admin/businesses" className="rounded-full px-3 py-2 hover:bg-canvas">Businesses</Link>
            <Link href="/admin/businesses?risk=1" className="rounded-full px-3 py-2 hover:bg-canvas">At risk</Link>
          </nav>
          <p className="hidden text-sm text-muted sm:block">{admin.email} · <Link href="/app" className="font-semibold text-brand hover:underline">Back to app</Link></p>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
