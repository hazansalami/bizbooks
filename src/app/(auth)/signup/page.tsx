import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "../auth-forms";
import { cookies } from "next/headers";
import { referrerByCode } from "@/lib/growth";
import { TRIAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Create your free account", alternates: { canonical: "/signup" } };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { ref } = await searchParams;
  const [cookieCode, cookieSource] = ((await cookies()).get("bb_ref")?.value ?? "").split("|");
  const code = (ref || cookieCode || "").toUpperCase();
  const referrer = await referrerByCode(code);
  const days = referrer ? TRIAL.referredDays : TRIAL.days;
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      {referrer && (
        <p className="mb-5 rounded-2xl bg-brand-wash p-4 text-sm text-brand-deep">
          <strong>{referrer.name}</strong> invited you. You get <strong>{days} days of BizBooks Pro free</strong>, double the usual trial.
        </p>
      )}
      <h1 className="text-2xl sm:text-3xl">Start your {days}-day Pro trial</h1>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {["Every Pro feature free for " + days + " days", "No card needed, nothing to cancel", "Then keep invoicing and bookkeeping free, or upgrade"].map((t) => (
          <li key={t} className="flex items-center gap-2"><Check className="size-4 text-brand" aria-hidden />{t}</li>
        ))}
      </ul>
      <div className="mt-6"><SignupForm referral={referrer ? `${code}|${code === cookieCode ? cookieSource || "LINK" : "LINK"}` : ""} /></div>
    </div>
  );
}
