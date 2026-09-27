import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { APP_NAME } from "@/lib/constants";
import { SOLUTIONS } from "../data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sol = SOLUTIONS.find((x) => x.slug === slug);
  if (!sol) return {};
  return { title: sol.title, description: sol.sub, alternates: { canonical: `/solutions/${sol.slug}` } };
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  if (!s) notFound();
  const related = SOLUTIONS.filter((x) => x.slug !== s.slug).slice(0, 3);
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
        <p className="text-sm font-bold uppercase tracking-widest text-brand">{s.group}</p>
        <h1 className="mt-3 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-6xl">{s.headline}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">{s.sub}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/signup" size="lg">Start free</ButtonLink>
          <ButtonLink href="/pricing" size="lg" variant="secondary">See pricing</ButtonLink>
        </div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-16 sm:grid-cols-2 sm:px-6">
          {s.points.map((p) => (
            <div key={p.title} className="rounded-2xl bg-canvas p-6">
              <Check className="size-6 rounded-full bg-brand p-1 text-white" aria-hidden />
              <h2 className="mt-4 text-xl">{p.title}</h2>
              <p className="mt-2 text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
          {s.faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.q}<span aria-hidden className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: s.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) }} />
      </section>

      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl">Also in {APP_NAME}</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <Link key={r.slug} href={`/solutions/${r.slug}`} className="rounded-2xl border border-line p-5 hover:border-ink">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{r.group}</p>
                <p className="mt-1 text-lg font-semibold">{r.name}</p>
                <p className="mt-1 text-sm text-ink-soft">{r.menu}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
