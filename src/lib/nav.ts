import {
  CalendarClock, FileSignature, FileText, Home, Landmark, LifeBuoy, LineChart, Receipt, Repeat, Settings, Users, UsersRound, Wallet,
} from "lucide-react";

export type Item = { href: string; label: string; icon: typeof Home; exact?: boolean; match?: string[] };

/** Grouped like Wave's own product: overview first, then get paid / spend / pay your team / stay tax-ready. */
export const NAV_GROUPS: { title?: string; items: Item[] }[] = [
  { items: [{ href: "/app", label: "Overview", icon: Home, exact: true }] },
  {
    title: "Get paid",
    items: [
      { href: "/app/invoices", label: "Invoices", icon: FileText, match: ["/app/invoices"] },
      { href: "/app/quotes", label: "Quotes", icon: FileSignature },
      { href: "/app/recurring", label: "Recurring invoices", icon: CalendarClock },
      { href: "/app/payments", label: "Payments received", icon: Wallet },
      { href: "/app/customers", label: "Clients", icon: Users },
    ],
  },
  {
    title: "Spend",
    items: [
      { href: "/app/expenses", label: "Expenses", icon: Receipt, exact: true, match: ["/app/expenses/new"] },
      { href: "/app/expenses/recurring", label: "Recurring expenses", icon: Repeat },
    ],
  },
  { title: "Pay your team", items: [{ href: "/app/payroll", label: "Payroll", icon: UsersRound }] },
  {
    title: "Stay tax-ready",
    items: [
      { href: "/app/reports", label: "Reports", icon: LineChart },
      { href: "/app/taxes", label: "Taxes", icon: Landmark },
      { href: "/app/advisors", label: "Advisors", icon: LifeBuoy },
    ],
  },
  { items: [{ href: "/app/settings", label: "Settings", icon: Settings }] },
];

export const NAV = NAV_GROUPS.flatMap((g) => g.items);
