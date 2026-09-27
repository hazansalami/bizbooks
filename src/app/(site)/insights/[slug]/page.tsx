import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Clock, ShieldCheck } from "lucide-react";
import { allArticles, CATEGORIES, getArticle, related } from "@/lib/insights";
import { siteUrl } from "@/lib/site-url";
import { APP_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return allArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return {};
  return {
    title: a.title,
    description: a.description,
    keywords: a.keywords,
    alternates: { canonical: `/insights/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.description, publishedTime: a.published, modifiedTime: a.updated, url: `/insights/${a.slug}` },
    twitter: { card: "summary_large_image", title: a.title, description: a.description },
  };
}

export default async function ArticlePage({ params }: Props) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  const base = siteUrl();
  const url = new URL(`/insights/${a.slug}`, base).toString();
  const more = related(a, 3);
  const cta = a.category === "payroll"
    ? { title: "Run payroll with 2026 PAYE worked out", href: "/solutions/payroll", label: "See payroll" }
    : a.category === "taxes"
      ? { title: "See every tax deadline coming, with the amount", href: "/solutions/taxes", label: "See tax tracking" }
      : a.category === "getting-paid"
        ? { title: "Invoices your clients' accounts teams can process, with reminders built in", href: "/solutions/invoicing", label: "See invoicing" }
        : { title: "Your company's finances, clear at a glance", href: "/solutions/accounting", label: "See bookkeeping & reports" };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: a.title,
        description: a.description,
        datePublished: a.published,
        dateModified: a.updated,
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: `${APP_NAME} Editorial Team`, url: base.toString() },
        publisher: { "@type": "Organization", name: APP_NAME, logo: { "@type": "ImageObject", url: new URL("/icons/icon-512.png", base).toString() } },
        keywords: a.keywords.join(", "),
        wordCount: a.words,
        inLanguage: "en-NG",
        ...(a.reviewer ? { reviewedBy: { "@type": "Person", name: a.reviewer } } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Insights", item: new URL("/insights", base).toString() },
          { "@type": "ListItem", position: 2, name: CATEGORIES[a.category].name, item: new URL(`/insights?topic=${a.category}`, base).toString() },
          { "@type": "ListItem", position: 3, name: a.title, item: url },
        ],
      },
      ...(a.faqs.length ? [{ "@type": "FAQPage", mainEntity: a.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }] : []),
    ],
  };

  return (
    <>
      <article className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-sm text-muted">
          <Link href="/insights" className="hover:text-ink">Insights</Link> <span aria-hidden>/</span>{" "}
          <Link href={`/insights?topic=${a.category}`} className="hover:text-ink">{CATEGORIES[a.category].name}</Link>
        </nav>
        <header className="mt-4 max-w-3xl">
          <h1 className="text-3xl leading-[1.1] tracking-[-0.025em] sm:text-5xl">{a.title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5"><CalendarCheck className="size-4" aria-hidden />Updated <time dateTime={a.updated}>{formatDate(a.updated)}</time></span>
            <span className="flex items-center gap-1.5"><Clock className="size-4" aria-hidden />{a.readingMinutes} min read</span>
            <span>By the {APP_NAME} Editorial Team</span>
            {a.reviewer && <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" aria-hidden />Reviewed by {a.reviewer}</span>}
          </p>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_16rem]">
          <div className="min-w-0 max-w-3xl">
            <aside aria-label="Quick answer" className="rounded-2xl border border-brand/25 bg-brand-wash p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-deep">The short answer</p>
              <p className="mt-2 text-[1.05rem] leading-relaxed text-ink">{a.summary}</p>
            </aside>
            <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: a.html }} />
            <p className="mt-10 rounded-xl bg-canvas p-4 text-sm text-muted">
              This guide is general information based on Nigerian law and published guidance as of {formatDate(a.updated)}. It isn't tax, legal or financial advice for your situation. Check with a qualified accountant or tax adviser before acting.
            </p>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-6">
              {a.toc.length > 2 && (
                <nav aria-label="On this page" className="text-sm">
                  <p className="mb-2 font-semibold">On this page</p>
                  <ul className="space-y-1.5 border-l border-line">
                    {a.toc.map((t) => <li key={t.id}><a href={`#${t.id}`} className="-ml-px block border-l-2 border-transparent pl-3 text-ink-soft hover:border-brand hover:text-ink">{t.text}</a></li>)}
                  </ul>
                </nav>
              )}
              <div className="rounded-2xl bg-ink p-5 text-white">
                <p className="font-semibold">{cta.title}</p>
                <ButtonLink href="/signup" size="sm" variant="light" className="mt-4 w-full">Start free</ButtonLink>
                <Link href={cta.href} className="mt-2 block text-center text-sm text-white/75 hover:text-white">{cta.label}</Link>
              </div>
            </div>
          </aside>
        </div>
      </article>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl">Keep reading</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {more.map((r) => (
              <Link key={r.slug} href={`/insights/${r.slug}`} className="group rounded-2xl border border-line p-5 hover:border-ink">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">{CATEGORIES[r.category].name}</p>
                <p className="mt-2 font-semibold leading-snug group-hover:text-brand-deep">{r.title}</p>
              </Link>
            ))}
          </div>
          <div className="mt-10 flex flex-col items-start gap-4 rounded-3xl bg-brand p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div><p className="text-xl font-bold">{cta.title}</p><p className="mt-1 text-white/85">{APP_NAME} is free to start. No card needed.</p></div>
            <ButtonLink href="/signup" variant="light" size="lg">Create my free account</ButtonLink>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </>
  );
}
