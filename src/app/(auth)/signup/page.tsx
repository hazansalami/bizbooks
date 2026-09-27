import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create your free account", alternates: { canonical: "/signup" } };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl">Create your free account</h1>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        {["Free forever for invoicing and bookkeeping", "No card needed"].map((t) => (
          <li key={t} className="flex items-center gap-2"><Check className="size-4 text-brand" aria-hidden />{t}</li>
        ))}
      </ul>
      <div className="mt-6"><SignupForm /></div>
    </div>
  );
}
