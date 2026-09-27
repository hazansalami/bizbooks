import Link from "next/link";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Wordmark: an open ledger whose right page is a tick. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#0E7A55" />
      <path d="M8 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#fff" opacity=".9" />
      <path d="M16 10.5c2.6-1.2 5.3-1.2 8 0v12c-2.7-1.2-5.4-1.2-8 0z" fill="#F2A541" />
      <path d="m18.2 16.6 1.7 1.7 3-3.4" stroke="#14201B" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex min-h-11 items-center gap-2 font-bold tracking-tight", light ? "text-white" : "text-ink", className)}>
      <Mark />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
