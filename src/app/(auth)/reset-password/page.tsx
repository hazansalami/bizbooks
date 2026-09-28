import type { Metadata } from "next";
import Link from "next/link";
import { resetTokenIsValid } from "@/app/actions/auth";
import { ResetPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false }, referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  const valid = await resetTokenIsValid(token);
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      {valid ? (
        <>
          <h1 className="text-2xl sm:text-3xl">Choose a new password</h1>
          <p className="mt-1 text-muted">You&apos;ll be logged in straight away, and signed out on your other devices.</p>
          <div className="mt-6"><ResetPasswordForm token={token} /></div>
        </>
      ) : (
        <>
          <h1 className="text-2xl sm:text-3xl">This link has expired</h1>
          <p className="mt-1 text-muted">Reset links work once, for an hour. Ask for a new one and use the latest email.</p>
          <Link href="/forgot-password" className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-deep">Send a new link</Link>
        </>
      )}
    </div>
  );
}
