import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Calculator, Clock } from "lucide-react";
import { allArticles, CATEGORIES, type Category } from "@/lib/insights";
import { formatDate } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "Insights: tax, payroll and finance guides for Nigerian companies",
  description: "Plain-English guides to the Nigeria Tax Act 2025, VAT, WHT, PAYE, payroll, invoicing and bookkeeping for Nigerian companies, plus free PAYE and VAT calculators.",
  alternates: { canonical: "/insights" },
};


export default async function Insights({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const articles = allArticles();
  const filter = topic && topic in CATEGORIES ? (topic as Category) : null;
  const featured = articles.filter((a) => a.featured).slice(0, 3);
  const shown = filter ? articles.filter((a) => a.category === filter) : articles;

  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-14 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-widest text-brand">{APP_NAME} Insights</p>
          <h1 className="mt-3 max-w-3xl text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">Money, tax and payroll for Nigerian companies, explained plainly.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">Practical guides updated for the 2026 tax rules, written for owners and finance leads who'd rather run the business than decode tax law.</p>
          <nav aria-label="Topics" className="mt-8 flex flex-wrap gap-2">
            <Link href="/insights" aria-current={!filter ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${!filter ? "bg-ink text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}>All topics</Link>
            {(Object.entries(CATEGORIES) as [Category, (typeof CATEGORIES)[Category]][]).map(([key, c]) => (
              <Link key={key} href={`/insights?topic=${key}`} aria-current={filter === key ? "page" : undefined} className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold ${filter === key ? "bg-ink text-white" : "bg-canvas text-ink-soft hover:text-ink"}`}>{c.name}</Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        {!filter && (
          <section aria-labelledby="featured">
            <h2 id="featured" className="text-2xl">Start here</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {featured.map((a) => (
                <Link key={a.slug} href={`/insights/${a.slug}`} className="group flex flex-col rounded-3xl border border-line bg-paper p-6 hover:border-ink">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand">{CATEGORIES[a.category].name}</p>
                  <h3 className="mt-2 text-xl leading-snug group-hover:text-brand-deep">{a.title}</h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-ink-soft">{a.summary}</p>
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" aria-hidden />{a.readingMinutes} min read · Updated {formatDate(a.updated)}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!filter && (
          <section aria-labelledby="tools" className="rounded-3xl bg-brand-wash p-6 sm:p-8">
            <h2 id="tools" className="flex items-center gap-2 text-2xl"><Calculator className="size-6 text-brand" aria-hidden />Free tools</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {TOOLS.map((t) => (
                <Link key={t.href} href={t.href} className="group flex items-center gap-4 rounded-2xl bg-paper p-5 hover:shadow-md">
                  <div className="flex-1"><p className="font-semibold group-hover:text-brand-deep">{t.title}</p><p className="text-sm text-ink-soft">{t.body}</p></div>
                  <ArrowRight className="size-5 text-brand" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        {(filter ? [filter] : (Object.keys(CATEGORIES) as Category[])).map((cat) => {
          const list = shown.filter((a) => a.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} aria-labelledby={`cat-${cat}`}>
              <h2 id={`cat-${cat}`} className="text-2xl">{CATEGORIES[cat].name}</h2>
              <p className="mt-1 text-ink-soft">{CATEGORIES[cat].blurb}</p>
              <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
                {list.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/insights/${a.slug}`} className="group flex items-start gap-4 p-5 hover:bg-canvas">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg leading-snug group-hover:text-brand-deep">{a.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{a.description}</p>
                      </div>
                      <span className="hidden shrink-0 text-xs text-muted sm:block">{a.readingMinutes} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: `${APP_NAME} Insights`,
            description: "Guides to tax, payroll, invoicing and bookkeeping for Nigerian companies.",
            hasPart: articles.map((a) => ({ "@type": "Article", headline: a.title, url: `/insights/${a.slug}`, dateModified: a.updated })),
          }),
        }}
      />
    </>
  );
}
