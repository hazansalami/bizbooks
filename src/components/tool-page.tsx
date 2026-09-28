import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TOOLS, TOOL_BY_SLUG } from "@/lib/tools";
import { getArticle } from "@/lib/insights";
import { siteUrl } from "@/lib/site-url";
import { APP_NAME } from "@/lib/constants";
import { ButtonLink } from "./ui";

export type ToolContent = {
  slug: string;
  h1: string;
  intro: string;
  howToTitle: string;
  howToIntro: string;
  steps: { name: string; text: string }[];
  example?: { title: string; rows: [string, string][]; note?: string };
  faqs: { q: string; a: string }[];
  articles: string[];
  cta: { title: string; body: string; href: string; label: string };
};

/**
 * Shared layout for public calculators: the tool first (ungated), then the method
 * ("How to calculate …") with a worked example and FAQ, all marked up for search and AI answers.
 */
export function ToolPage({ c, children }: { c: ToolContent; children: React.ReactNode }) {
  const tool = TOOL_BY_SLUG[c.slug];
  const base = siteUrl();
  const others = TOOLS.filter((t) => t.slug !== c.slug).slice(0, 4);
  const articles = c.articles.map((s) => getArticle(s)).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebApplication", name: tool.title, url: new URL(tool.href, base).toString(), applicationCategory: "FinanceApplication", operatingSystem: "Web", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "NGN" }, provider: { "@type": "Organization", name: APP_NAME } },
      { "@type": "HowTo", name: c.howToTitle, description: c.howToIntro, step: c.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, name: s.name, text: s.text })) },
      { "@type": "FAQPage", mainEntity: c.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Free calculators", item: new URL("/tools", base).toString() },
        { "@type": "ListItem", position: 2, name: tool.title, item: new URL(tool.href, base).toString() },
      ] },
    ],
  };

  return (
    <>
      <section className="mx-auto max-w-5xl px-4 pb-10 pt-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/tools" className="hover:text-ink">Free calculators</Link> / {tool.group}</nav>
        <h1 className="mt-3 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">{c.h1}</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-soft">{c.intro}</p>
        <div className="mt-8">{children}</div>
        <p className="mt-3 text-xs text-muted">Free, no sign-up. Estimates based on Nigerian rules as of 2026. Not tax advice. See our <Link href="/terms" className="underline">terms</Link>.</p>
      </section>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl">{c.howToTitle}</h2>
          <p className="mt-3 text-lg text-ink-soft">{c.howToIntro}</p>
          <ol className="mt-6 space-y-4">
            {c.steps.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span className="num grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                <div><p className="font-semibold">{s.name}</p><p className="text-ink-soft">{s.text}</p></div>
              </li>
            ))}
          </ol>

          {c.example && (
            <div className="mt-10">
              <h3 className="text-xl">{c.example.title}</h3>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
                <table className="num w-full text-sm">
                  <tbody>
                    {c.example.rows.map(([k, v], i) => (
                      <tr key={k} className={i ? "border-t border-line" : ""}><th scope="row" className="p-3 text-left font-medium">{k}</th><td className="p-3 text-right font-semibold">{v}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {c.example.note && <p className="mt-2 text-sm text-muted">{c.example.note}</p>}
            </div>
          )}

          <h2 className="mt-14 text-3xl">Questions</h2>
          <div className="mt-5 divide-y divide-line rounded-2xl border border-line">
            {c.faqs.map((f) => (
              <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{f.q}<span aria-hidden className="text-xl text-muted group-open:rotate-45">+</span></summary>
                <p className="mt-2 text-ink-soft">{f.a}</p>
              </details>
            ))}
          </div>

          {articles.length > 0 && (
            <>
              <h2 className="mt-14 text-2xl">Related guides</h2>
              <ul className="mt-4 space-y-2">
                {articles.map((a) => <li key={a!.slug}><Link href={`/insights/${a!.slug}`} className="font-semibold text-brand-deep underline underline-offset-4">{a!.title}</Link></li>)}
              </ul>
            </>
          )}

          <div className="mt-14 rounded-3xl bg-ink p-6 text-white sm:p-8">
            <p className="text-xl font-bold">{c.cta.title}</p>
            <p className="mt-1 text-white/80">{c.cta.body}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <ButtonLink href="/signup" variant="light">Start free</ButtonLink>
              <Link href={c.cta.href} className="inline-flex min-h-11 items-center px-2 font-semibold text-white/85 hover:text-white">{c.cta.label} →</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl">More free calculators</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {others.map((t) => (
              <Link key={t.slug} href={t.href} className="group flex items-center gap-3 rounded-2xl border border-line bg-paper p-4 hover:border-ink">
                <div className="flex-1"><p className="font-semibold group-hover:text-brand-deep">{t.title}</p><p className="text-sm text-ink-soft">{t.body}</p></div>
                <ArrowRight className="size-4 text-brand" aria-hidden />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
