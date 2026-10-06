"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BadgeCent, ChevronDown, FileSignature, FileText, Home, LayoutGrid, Plus, Receipt, Users, UsersRound, X } from "lucide-react";
import { navFor, type Item, type NavFlags } from "@/lib/nav";
import { cn } from "@/lib/utils";



function useActive() {
  const path = usePathname();
  return (item: Pick<Item, "href" | "exact" | "match">) => {
    if (item.match?.some((m) => path.startsWith(m))) return true;
    if (item.exact) return path === item.href || (item.href === "/app/expenses" && /^\/app\/expenses\/(?!recurring)[^/]+$/.test(path));
    return path === item.href || path.startsWith(item.href + "/");
  };
}

const linkClass = (on: boolean) =>
  cn("flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.93rem] font-medium transition-colors", on ? "bg-brand-wash font-semibold text-brand-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink");

/**
 * Sidebar, Wave-style: top-level pages with icons, and groups that expand to show their pages. The group
 * holding the current page is open unless the owner closes it; any group can be opened or closed.
 */
export function SideNav({ flags = {} }: { flags?: NavFlags }) {
  const active = useActive();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  return (
    <nav aria-label="App" className="flex flex-col gap-4 overflow-y-auto">
      <QuickActions variant="side" />
      <ul className="flex flex-col gap-0.5">
        {navFor(flags).map((g, i) => {
          if (!g.title || !g.icon || g.items.length === 1) {
            return g.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} aria-current={active(item) ? "page" : undefined} className={linkClass(active(item))}>
                  <item.icon className="size-[1.1rem]" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ));
          }
          const hasActive = g.items.some((item) => active(item));
          const open = toggled[g.title] ?? hasActive;
          const Icon = g.icon;
          const id = `nav-group-${i}`;
          return (
            <li key={g.title}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setToggled((t) => ({ ...t, [g.title!]: !open }))}
                className={cn(
                  "flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.93rem] transition-colors hover:bg-line/50",
                  open ? "font-semibold text-ink" : hasActive ? "bg-brand-wash font-semibold text-brand-deep" : "font-medium text-ink-soft hover:text-ink",
                )}
              >
                <Icon className="size-[1.1rem]" aria-hidden />
                <span className="flex-1">{g.title}</span>
                <ChevronDown className={cn("size-4 text-muted transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
              </button>
              <ul id={id} hidden={!open} className="mt-0.5 flex flex-col gap-0.5">
                {g.items.map((item) => {
                  const on = active(item);
                  return (
                    <li key={item.href}>
                      <Link href={item.href} aria-current={on ? "page" : undefined}
                        className={cn("flex min-h-9 items-center rounded-xl pl-[2.6rem] pr-3 text-[0.9rem] transition-colors", on ? "bg-brand-wash font-semibold text-brand-deep" : "text-ink-soft hover:bg-line/50 hover:text-ink")}>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const ACTIONS = [
  { href: "/app/invoices/new", label: "New invoice", icon: FileText },
  { href: "/app/quotes/new", label: "New quote", icon: FileSignature },
  { href: "/app/expenses/new", label: "Record expense", icon: Receipt },
  { href: "/app/payroll", label: "Run payroll", icon: UsersRound },
  { href: "/app/customers/new", label: "Add client", icon: Users },
];

/** "+ New" menu: the main things an owner does, one tap away. */
export function QuickActions({ variant }: { variant: "side" | "fab" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const path = usePathname();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  // Close after navigating.
  const [lastPath, setLastPath] = useState(path);
  if (lastPath !== path) {
    setLastPath(path);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn("relative", variant === "fab" && "flex justify-center")}>
      {variant === "side" ? (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 font-semibold text-white hover:bg-brand-deep">
          <Plus className="size-5" aria-hidden /> New
        </button>
      ) : (
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" aria-label={open ? "Close" : "Create new"}
          className="-mt-5 grid size-14 place-items-center rounded-full bg-brand text-white shadow-lg shadow-brand/30 ring-4 ring-canvas">
          {open ? <X className="size-7" aria-hidden /> : <Plus className="size-7" aria-hidden />}
        </button>
      )}
      {open && (
        <div role="menu" className={cn("absolute z-50 w-56 overflow-hidden rounded-2xl border border-line bg-paper py-1.5 shadow-xl", variant === "side" ? "left-0 top-full mt-2" : "bottom-full mb-3")}>
          {ACTIONS.map((a) => (
            <Link key={a.href + a.label} role="menuitem" href={a.href} className="flex min-h-11 items-center gap-3 px-4 text-[0.95rem] font-medium hover:bg-canvas">
              <a.icon className="size-5 text-brand" aria-hidden />{a.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const BOTTOM: (Item | null)[] = [
  { href: "/app", label: "Overview", icon: Home, exact: true },
  { href: "/app/invoices", label: "Invoices", icon: FileText },
  null,
  { href: "/app/payroll", label: "Payroll", icon: BadgeCent },
];

export function BottomNav() {
  const active = useActive();
  const inBottom = BOTTOM.some((b) => b && active(b));
  const moreOn = !inBottom;
  return (
    <nav aria-label="App" className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {BOTTOM.map((item, i) =>
          item ? (
            <li key={item.href}>
              <Link href={item.href} aria-current={active(item) ? "page" : undefined} className={cn("flex min-h-15 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", active(item) ? "text-brand" : "text-muted")}>
                <item.icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          ) : (
            <li key={`new-${i}`} className="flex items-center justify-center"><QuickActions variant="fab" /></li>
          ),
        )}
        <li>
          <Link href="/app/more" aria-current={moreOn ? "page" : undefined} className={cn("flex min-h-15 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold", moreOn ? "text-brand" : "text-muted")}>
            <LayoutGrid className="size-5" aria-hidden />
            More
          </Link>
        </li>
      </ul>
    </nav>
  );
}
