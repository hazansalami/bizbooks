import Link from "next/link";
import { cn } from "@/lib/utils";

export function ExpenseTabs({ active, unpaid = 0 }: { active: "all" | "bills" | "recurring"; unpaid?: number }) {
  return (
    <nav aria-label="Expenses" className="mb-5 flex gap-1.5">
      {[["all", "All expenses", "/app/expenses"], ["bills", unpaid ? `Unpaid bills (${unpaid})` : "Unpaid bills", "/app/expenses?filter=bills"], ["recurring", "Recurring", "/app/expenses/recurring"]].map(([key, label, href]) => (
        <Link key={key} href={href} aria-current={active === key ? "page" : undefined}
          className={cn("inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold", active === key ? "bg-ink text-white" : "bg-paper text-ink-soft ring-1 ring-line hover:ring-ink")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
