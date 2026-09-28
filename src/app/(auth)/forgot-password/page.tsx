import type { Metadata } from "next";
import { ForgotPasswordForm } from "../auth-forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl">Forgot your password?</h1>
      <p className="mt-1 text-muted">Enter the email you sign in with and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-6"><ForgotPasswordForm /></div>
    </div>
  );
}
