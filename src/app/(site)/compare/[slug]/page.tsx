import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { CompareTable } from "@/components/compare-table";
import { APP_NAME } from "@/lib/constants";
import { COMPARE_PAGES, COMPARE_SOURCES, RIVALS } from "@/lib/compare";
import { siteUrl } from "@/lib/site-url";

type Props = { params: Promise<{ slug: string }> };

const CHECKED = "28 September 2026";

export function generateStaticParams() {
  return COMPARE_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = COMPARE_PAGES.find((x) => x.slug === slug);
  if (!p) return {};
  return { title: p.title, description: p.description, alternates: { canonical: `/compare/${p.slug}` }, openGraph: { title: p.title, description: p.description } };
}

export default async function ComparePage({ params }: Props) {
  const { slug } = await params;
  const p = COMPARE_PAGES.find((x) => x.slug === slug);
  if (!p) notFound();
  const rival = RIVALS[p.rival];
  const other = COMPARE_PAGES.find((x) => x.slug !== p.slug)!;
  const url = (path: string) => new URL(path, siteUrl()).toString();

  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/" className="hover:text-ink">Home</Link> / Compare</nav>
        <h1 className="mt-3 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-6xl">{p.h1}</h1>
        <p className="mt-3 text-lg text-ink-soft">For Nigerian companies in 2026. Last checked {CHECKED}.</p>
        <div className="mt-6 rounded-2xl border border-brand/30 bg-brand-wash/60 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-deep">The short answer</p>
          <p className="mt-2 text-ink">{p.answer}</p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/signup" size="lg">Start free</ButtonLink>
          <ButtonLink href="#switch" size="lg" variant="secondary"><Upload className="size-5" aria-hidden /> How to switch from {rival.name}</ButtonLink>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <h2 className="text-3xl">Feature by feature</h2>
        <div className="mt-6"><CompareTable rivals={[p.rival]} /></div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-3xl">Where {APP_NAME} is ahead</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {p.wins.map((w) => (
              <div key={w.title} className="rounded-2xl bg-canvas p-6">
                <Check className="size-6 rounded-full bg-brand p-1 text-white" aria-hidden />
                <h3 className="mt-4 text-xl">{w.title}</h3>
                <p className="mt-2 text-ink-soft">{w.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-2xl border border-line p-6">
            <h2 className="text-2xl">Where {rival.name} is ahead</h2>
            <p className="mt-1 text-ink-soft">We&apos;d rather you choose well than switch twice.</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-soft">
              {p.theyWin.map((t) => <li key={t}>{t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section id="switch" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl">Switch from {rival.name} in three steps</h2>
        <ol className="mt-6 space-y-4">
          {p.switchSteps.map((s, i) => (
            <li key={s} className="flex gap-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-bold text-white">{i + 1}</span>
              <p className="pt-1.5 text-ink-soft">{s}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-ink-soft">
          Imported invoices never email your clients, and importing the same file twice is safe. Step-by-step guide: <Link href="/insights/move-from-wave-or-zoho-books" className="font-semibold text-brand hover:underline">moving your books from Wave or Zoho Books</Link>.
        </p>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
          {p.faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.q}<span aria-hidden className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-10 text-sm text-muted">
          <p className="font-semibold text-ink">Sources</p>
          <ul className="mt-2 space-y-1">
            {COMPARE_SOURCES.filter((s) => s.label.toLowerCase().includes(p.rival === "zoho" ? "zoho" : "wave")).map((s) => (
              <li key={s.href}><a href={s.href} className="underline hover:text-ink" rel="nofollow noopener" target="_blank">{s.label}</a></li>
            ))}
          </ul>
          <p className="mt-3">Also compare: <Link href={`/compare/${other.slug}`} className="font-semibold text-brand hover:underline">{other.h1}</Link></p>
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
          { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: url("/") },
            { "@type": "ListItem", position: 2, name: p.h1, item: url(`/compare/${p.slug}`) },
          ] },
        ]) }} />
      </section>
    </>
  );
}
