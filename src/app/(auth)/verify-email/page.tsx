import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { sendVerificationEmail, verifyEmailToken } from "@/lib/verify-email";
import { ButtonLink, Notice } from "@/components/ui";
import { SubmitButton } from "@/components/form-bits";

export const metadata: Metadata = { title: "Confirm your email", robots: { index: false } };

type Props = { searchParams: Promise<{ token?: string; next?: string; sent?: string }> };

const safeNext = (next?: string) => (next && /^\/(app|admin)(\/|$)/.test(next) ? next : "/app");

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { token, next, sent } = await searchParams;
  const dest = safeNext(next);

  if (token) {
    const ok = await verifyEmailToken(token);
    return (
      <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
        <h1 className="text-2xl sm:text-3xl">{ok ? "Email confirmed" : "That link didn't work"}</h1>
        <p className="mt-1 text-muted">{ok ? "Thanks. Your email address is confirmed." : "It may have expired (links last 24 hours) or been sent to a different address. Sign in and ask for a new one."}</p>
        <div className="mt-6"><ButtonLink href={ok ? dest : "/verify-email"}>{ok ? "Continue" : "Send a new link"}</ButtonLink></div>
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/verify-email")}`);
  if (user.emailVerifiedAt) redirect(dest);

  async function send() {
    "use server";
    const u = await getCurrentUser();
    if (!u) redirect("/login");
    await sendVerificationEmail(u, dest);
    redirect(`/verify-email?sent=1&next=${encodeURIComponent(dest)}`);
  }

  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl">Confirm your email</h1>
      <p className="mt-1 text-muted">
        {dest.startsWith("/admin") ? "The admin dashboard needs a confirmed email address. " : ""}
        We&apos;ll send a link to <strong>{user.email}</strong>. Open it on any device to confirm.
      </p>
      {sent && <Notice tone="brand" className="mt-4">Link sent. Check your inbox (and spam folder). It works for 24 hours.</Notice>}
      <form action={send} className="mt-6">
        <SubmitButton pendingText="Sending…">{sent ? "Send it again" : "Email me a link"}</SubmitButton>
      </form>
    </div>
  );
}
