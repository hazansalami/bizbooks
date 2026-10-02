import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { APP_NAME, PLANS, TRIAL } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { SOLUTIONS, SOLUTIONS_UPDATED } from "../data";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const sol = SOLUTIONS.find((x) => x.slug === slug);
  if (!sol) return {};
  return {
    title: sol.title,
    description: sol.description,
    alternates: { canonical: `/solutions/${sol.slug}` },
    openGraph: { title: sol.title, description: sol.description, url: `/solutions/${sol.slug}`, type: "website" },
  };
}

/** One call to action, repeated: the free trial, with the reasons it's safe to try. */
function Cta({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/signup" size="lg">Start free with {TRIAL.days} days of Pro</ButtonLink>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
        {["No card needed", "Free plan forever after", "Import from Wave or Zoho"].map((t) => (
          <li key={t} className="flex items-center gap-1.5"><Check className="size-4 text-brand" aria-hidden />{t}</li>
        ))}
      </ul>
    </div>
  );
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const s = SOLUTIONS.find((x) => x.slug === slug);
  if (!s) notFound();
  const related = SOLUTIONS.filter((x) => x.slug !== s.slug && x.group === s.group).concat(SOLUTIONS.filter((x) => x.group !== s.group)).slice(0, 3);

  return (
    <>
      {/* Hero: the outcome, the problem it removes, one action, and the proof beside it */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pb-20 lg:pt-20">
          <div>
            <nav aria-label="Breadcrumb" className="text-sm text-muted">
              <Link href="/" className="hover:text-ink">Home</Link> <span aria-hidden>/</span> <span>{s.group}</span>
            </nav>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-sun-wash px-3 py-1 text-sm font-semibold text-sun-ink">
              <span className="size-2 rounded-full bg-sun" aria-hidden /> {s.eyebrow}
            </p>
            <h1 className="mt-5 text-[2.5rem] leading-[1.03] tracking-[-0.035em] sm:text-6xl">{s.headline}</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">{s.sub}</p>
            <Cta className="mt-8" />
          </div>

          <figure className="rounded-3xl border border-line bg-paper p-5 shadow-sm sm:p-6">
            <figcaption>
              <p className="text-xs font-bold uppercase tracking-widest text-brand">Worked example</p>
              <p className="mt-1 text-lg font-semibold">{s.example.title.replace(/^Worked example: (.)/, (_, c: string) => c.toUpperCase())}</p>
              <p className="mt-1 text-sm text-ink-soft">{s.example.intro}</p>
            </figcaption>
            <table className="num mt-4 w-full text-sm">
              <tbody>
                {s.example.rows.map((r) => (
                  <tr key={r.label} className={r.strong ? "border-t-2 border-ink/80 font-bold" : "border-t border-line"}>
                    <th scope="row" className={r.strong ? "py-2.5 pr-3 text-left font-bold" : "py-2.5 pr-3 text-left font-normal text-ink-soft"}>{r.label}</th>
                    <td className="whitespace-nowrap py-2.5 text-right">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">{s.example.note}</p>
          </figure>
        </div>
      </section>

      {/* The short answer: self-contained, so it reads well quoted on its own */}
      <section className="border-y border-line bg-paper">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl sm:text-3xl">{s.answer.q}</h2>
          <p className="mt-3 text-lg text-ink-soft">{s.answer.a}</p>
        </div>
      </section>

      {/* The problem, in the reader's own words */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-3xl text-3xl sm:text-4xl">Sound familiar?</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {s.pains.map((p) => (
            <div key={p.title} className="rounded-3xl border border-line bg-paper p-6">
              <h3 className="text-xl">{p.title}</h3>
              <p className="mt-2 text-ink-soft">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 max-w-3xl border-l-4 border-sun pl-4 text-lg">{s.stakes}</p>
      </section>

      {/* Before and after */}
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-3xl text-3xl sm:text-4xl">Before and after {APP_NAME}</h2>
          <div className="mt-8 overflow-hidden rounded-3xl border border-white/10">
            <table className="w-full text-left">
              <thead className="bg-white/[0.06] text-sm uppercase tracking-wider text-white/70">
                <tr><th scope="col" className="p-4 font-semibold">Without {APP_NAME}</th><th scope="col" className="p-4 font-semibold text-sun">With {APP_NAME}</th></tr>
              </thead>
              <tbody>
                {s.compare.map((c) => (
                  <tr key={c.with} className="border-t border-white/10 align-top">
                    <td className="p-4 text-white/70"><span className="flex gap-2"><X className="mt-0.5 size-4 shrink-0 text-white/40" aria-hidden />{c.without}</span></td>
                    <td className="p-4 font-medium"><span className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden />{c.with}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="max-w-3xl text-3xl sm:text-4xl">What changes for your company</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {s.benefits.map((b) => (
            <div key={b.title} className="rounded-3xl bg-paper p-6 ring-1 ring-line">
              <Check className="size-6 rounded-full bg-brand p-1 text-white" aria-hidden />
              <h3 className="mt-4 text-xl">{b.title}</h3>
              <p className="mt-2 text-ink-soft">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="max-w-3xl text-3xl sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {s.steps.map((st, i) => (
              <li key={st.title} className="rounded-3xl bg-canvas p-6">
                <span className="grid size-10 place-items-center rounded-full bg-ink font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 text-xl">{st.title}</h3>
                <p className="mt-2 text-ink-soft">{st.body}</p>
              </li>
            ))}
          </ol>
          <Cta className="mt-10" />
        </div>
      </section>

      {/* Objections */}
      <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl sm:text-4xl">Questions companies ask</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
          {s.faqs.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.q}<span aria-hidden className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        {s.resources.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl">Go deeper, free</h2>
            <ul className="mt-3 space-y-2">
              {s.resources.map((r) => (
                <li key={r.href}><Link href={r.href} className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">{r.label}<ArrowRight className="size-4" aria-hidden /></Link></li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-8 text-sm text-muted">Last updated {formatDate(SOLUTIONS_UPDATED)}. Tax rates and deadlines follow the Nigeria Tax Act 2025, in force from 1 January 2026.</p>
      </section>

      {/* Final call to action, with the risk taken out */}
      <section className="bg-brand-deep text-white">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl sm:text-5xl">{s.close.headline}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/85">{s.close.sub}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" size="lg" variant="light">Start free with {TRIAL.days} days of Pro</ButtonLink>
            <ButtonLink href="/pricing" size="lg" variant="secondary" className="border-white/40 bg-transparent text-white hover:border-white">See pricing</ButtonLink>
          </div>
          <p className="mt-5 text-sm text-white/75">Pro is ₦{PLANS.PRO.monthly.toLocaleString("en-NG")} a month after the trial, or stay on the Free plan. Nothing is charged automatically.</p>
        </div>
      </section>

      {/* Related */}
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: s.faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
            {
              "@context": "https://schema.org", "@type": "WebPage", name: s.title, description: s.description, dateModified: SOLUTIONS_UPDATED,
              breadcrumb: { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: "/" }, { "@type": "ListItem", position: 2, name: s.name, item: `/solutions/${s.slug}` }] },
              about: {
                "@type": "SoftwareApplication", name: APP_NAME, applicationCategory: "BusinessApplication", operatingSystem: "Web, Android, iOS",
                offers: [
                  { "@type": "Offer", name: "Free", price: "0", priceCurrency: "NGN" },
                  { "@type": "Offer", name: "Pro (monthly)", price: String(PLANS.PRO.monthly), priceCurrency: "NGN" },
                ],
              },
            },
          ]),
        }}
      />
    </>
  );
}
