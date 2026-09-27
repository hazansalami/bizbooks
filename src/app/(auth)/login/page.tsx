import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "../auth-forms";

export const metadata: Metadata = { title: "Log in", alternates: { canonical: "/login" } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/app");
  const { next } = await searchParams;
  return (
    <div className="rounded-3xl border border-line bg-paper p-6 sm:p-8">
      <h1 className="text-2xl sm:text-3xl">Welcome back</h1>
      <p className="mt-1 text-muted">Log in to see who has paid and who still owes you.</p>
      <div className="mt-6"><LoginForm next={next} /></div>
    </div>
  );
}
