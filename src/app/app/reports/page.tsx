import Link from "next/link";
import { ChevronRight, Download, Lock } from "lucide-react";
import { requireBusiness } from "@/lib/auth";
import { isPro } from "@/lib/plan";
import { buttonClass, PageHeader } from "@/components/ui";
import { REPORT_GROUPS } from "./catalog";

export const metadata = { title: "Reports" };

export default async function Reports() {
  const { business } = await requireBusiness();
  const pro = isPro(business);
  return (
    <>
      <PageHeader
        title="Reports"
        description="The statements your accountant, bank and investors ask for, in plain English."
        actions={pro ? (
          <a href="/app/reports/export?period=this-year" download className={buttonClass("secondary")}><Download className="size-4" aria-hidden /> Export this year (CSV)</a>
        ) : (
          <Link href="/app/settings/billing" className={buttonClass("secondary")}><Lock className="size-4" aria-hidden /> CSV export (Pro)</Link>
        )}
      />
      <div className="space-y-8">
        {REPORT_GROUPS.map((g) => (
          <section key={g.title} aria-labelledby={`r-${g.title.replace(/\W+/g, "-")}`}>
            <h2 id={`r-${g.title.replace(/\W+/g, "-")}`} className="text-lg">{g.title}</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">{g.blurb}</p>
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {g.reports.map((r) => (
                <li key={r.slug}>
                  {r.soon ? (
                    <div className="flex h-full items-start gap-3 rounded-2xl border border-dashed border-line-strong bg-paper/60 p-4">
                      <div className="flex-1"><p className="font-semibold text-ink-soft">{r.title} <span className="ml-1 rounded-full bg-line px-2 py-0.5 text-xs font-semibold text-muted">Coming soon</span></p><p className="mt-0.5 text-sm text-muted">{r.blurb}</p></div>
                    </div>
                  ) : (
                    <Link href={r.slug === "taxes" ? "/app/taxes" : `/app/reports/${r.slug}`} className="flex h-full items-start gap-3 rounded-2xl border border-line bg-paper p-4 hover:border-ink">
                      <div className="flex-1"><p className="font-semibold text-brand-deep">{r.title}</p><p className="mt-0.5 text-sm text-ink-soft">{r.blurb}</p></div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted" aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
