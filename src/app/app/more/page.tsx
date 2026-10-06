import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { navFor } from "@/lib/nav";
import { requireBusiness } from "@/lib/auth";
import { InstallPrompt } from "@/components/pwa";
import { PageHeader } from "@/components/ui";
import { logout } from "@/app/actions/auth";

export const metadata = { title: "More" };

export default async function More() {
  const { business } = await requireBusiness();
  return (
    <>
      <PageHeader title="More" />
      <InstallPrompt />
      <div className="mt-4 space-y-5">
        {navFor(business).slice(1).map((g, i) => (
          <section key={i}>
            {g.title && <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted">{g.title}</h2>}
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
              {g.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-14 items-center gap-3 px-4 font-medium hover:bg-canvas">
                    <Icon className="size-5 text-brand" aria-hidden />
                    <span className="flex-1">{label}</span>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <form action={logout} className="mt-6">
        <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-paper font-semibold text-danger">
          <LogOut className="size-4" aria-hidden /> Log out
        </button>
      </form>
    </>
  );
}
