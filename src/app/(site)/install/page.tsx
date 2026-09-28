import type { Metadata } from "next";
import { Bell, Download, MoreVertical, Share, SquarePlus, WifiOff, Zap } from "lucide-react";
import { InstallButton } from "@/components/pwa";
import { APP_NAME } from "@/lib/constants";

const title = `Get the ${APP_NAME} app on Android, iPhone and desktop`;
const description = `Install ${APP_NAME} on your phone or computer in seconds, straight from your browser. No app store, very little data, opens to your dashboard in one tap.`;

export const metadata: Metadata = { title, description, alternates: { canonical: "/install" } };

const STEPS = [
  {
    device: "Android (Chrome)",
    steps: [
      <>Open {APP_NAME} in Chrome and sign in.</>,
      <>Tap <strong>Install app</strong> on this page, or open the <MoreVertical className="inline size-4 align-[-2px]" aria-label="menu" /> menu and tap <strong>Install app</strong> / <strong>Add to Home screen</strong>.</>,
      <>Confirm. {APP_NAME} appears with your other apps.</>,
    ],
  },
  {
    device: "iPhone and iPad (Safari)",
    steps: [
      <>Open {APP_NAME} in <strong>Safari</strong> and sign in.</>,
      <>Tap <Share className="inline size-4 align-[-2px]" aria-label="Share" /> <strong>Share</strong> at the bottom (top right on iPad).</>,
      <>Scroll down, tap <SquarePlus className="inline size-4 align-[-2px]" aria-label="Add" /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</>,
    ],
  },
  {
    device: "Computer (Chrome or Edge)",
    steps: [
      <>Open {APP_NAME} and sign in.</>,
      <>Click <strong>Install the app</strong> here, or the <Download className="inline size-4 align-[-2px]" aria-label="install" /> install icon at the right of the address bar.</>,
      <>It opens in its own window and can be pinned to your taskbar or dock.</>,
    ],
  },
];

const FAQS = [
  { q: "Is the BizBooks app free?", a: `Yes. The app is the same ${APP_NAME} you use in the browser, so it's included on every plan, Free and Pro.` },
  { q: "Why isn't it on the Play Store or App Store?", a: "It installs straight from your browser as a web app. You always have the latest version, it takes up very little space, and there's nothing to update." },
  { q: "Does it work offline?", a: "It opens without a connection and shows what to do next, but creating invoices, recording payments and running payroll need internet so your books stay in sync." },
  { q: "I don't see the install option. What do I do?", a: "On iPhone, use Safari (other iPhone browsers may hide the option). On Android, use Chrome. If you've installed before, it may already be on your home screen." },
];

export default function InstallPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" width={72} height={72} className="mx-auto size-18" />
        <h1 className="mt-5 text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl">{APP_NAME} on your home screen</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">
          Send an invoice, check who&apos;s paid or snap a receipt in one tap. Installs from your browser in seconds. No app store.
        </p>
        <div className="mt-8 flex justify-center"><InstallButton size="lg" fallback={<a href="#how" className="font-semibold text-brand-deep hover:underline">See the steps for your device ↓</a>} /></div>
      </section>

      <section className="border-y border-line bg-paper">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-3">
          {[
            [Zap, "One tap to your dashboard", "No typing the address or hunting for a tab. It opens full-screen, like any app."],
            [Bell, "Right where you work", "Next to WhatsApp and your bank app, so invoicing and following up take seconds."],
            [WifiOff, "Light and always current", "Tiny download, very little data, and always the latest version."],
          ].map(([Icon, t, d]) => {
            const I = Icon as typeof Zap;
            return (
              <div key={t as string} className="rounded-2xl bg-canvas p-6">
                <I className="size-6 text-brand" aria-hidden />
                <h2 className="mt-3 text-lg">{t as string}</h2>
                <p className="mt-1 text-ink-soft">{d as string}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-3xl">How to install</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {STEPS.map((d) => (
            <div key={d.device} className="rounded-2xl border border-line bg-paper p-6">
              <h3 className="text-lg">{d.device}</h3>
              <ol className="mt-3 space-y-3">
                {d.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-ink-soft">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-wash text-sm font-bold text-brand-deep">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <h2 className="text-3xl">Questions</h2>
        <div className="mt-6 divide-y divide-line rounded-2xl border border-line bg-paper">
          {FAQS.map((f) => (
            <details key={f.q} className="group p-5 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">{f.q}<span aria-hidden className="text-2xl font-normal text-muted transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }) }} />
      </section>
    </>
  );
}
