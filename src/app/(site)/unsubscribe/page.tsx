import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { unsubscribeByToken } from "@/lib/nurture";
import { buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

async function unsubscribe(form: FormData) {
  "use server";
  const token = String(form.get("t") ?? "");
  await unsubscribeByToken(token);
  redirect("/unsubscribe?done=1");
}

// A button rather than an automatic unsubscribe on page load, so link scanners in email filters can't unsubscribe people.
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  return (
    <section className="mx-auto max-w-md px-4 py-20 text-center">
      {done ? (
        <>
          <CheckCircle2 className="mx-auto size-10 text-brand" aria-hidden />
          <h1 className="mt-4 text-3xl">You're unsubscribed</h1>
          <p className="mt-2 text-ink-soft">We won't send you any more guides. Our free calculators and articles are always here when you need them.</p>
          <Link href="/tools" className={buttonClass("secondary", "md", "mt-6")}>Free calculators</Link>
        </>
      ) : t ? (
        <>
          <h1 className="text-3xl">Unsubscribe from BizBooks guides?</h1>
          <p className="mt-2 text-ink-soft">You'll stop getting follow-up emails from our calculators.</p>
          <form action={unsubscribe} className="mt-6">
            <input type="hidden" name="t" value={t} />
            <button className={buttonClass("primary", "lg")}>Unsubscribe</button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-3xl">Unsubscribe</h1>
          <p className="mt-2 text-ink-soft">Use the link at the bottom of any email we've sent you.</p>
        </>
      )}
    </section>
  );
}
