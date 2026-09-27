"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { SOLUTIONS, SOLUTION_GROUPS } from "@/app/(site)/solutions/data";
import { cn } from "@/lib/utils";

function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open, close]);
  return ref;
}

function Groups({ onPick }: { onPick?: () => void }) {
  return (
    <>
      {SOLUTION_GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-2 px-3 text-xs font-bold uppercase tracking-wider text-muted">{g}</p>
          <ul>
            {SOLUTIONS.filter((s) => s.group === g).map((s) => (
              <li key={s.slug}>
                <Link href={`/solutions/${s.slug}`} onClick={onPick} className="block rounded-xl px-3 py-2.5 hover:bg-canvas">
                  <span className="block font-semibold">{s.name}</span>
                  <span className="block text-sm text-muted">{s.menu}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

/** Desktop "Solutions" menu, grouped like Wave's: stay organized & tax-ready / get paid / pay your team. */
export function SolutionsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const path = usePathname();
  const [last, setLast] = useState(path);
  if (last !== path) { setLast(path); setOpen(false); }
  return (
    <div ref={ref} className="relative hidden md:block">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-semibold text-ink-soft hover:text-ink">
        Solutions <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="fixed left-1/2 top-[4.25rem] z-50 grid w-[min(56rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-4 rounded-3xl border border-line bg-paper p-5 shadow-2xl">
          <Groups />
        </div>
      )}
    </div>
  );
}

export function MobileMenu({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} className="md:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} className="grid size-11 place-items-center rounded-full hover:bg-line/60">
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      {open && (
        <div className="fixed inset-x-0 top-16 z-50 max-h-[calc(100dvh-4rem)] space-y-5 overflow-y-auto border-b border-line bg-paper p-4 shadow-xl">
          <Groups onPick={() => setOpen(false)} />
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <Link href="/insights" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold hover:bg-canvas">Resources</Link>
            <Link href="/advisors" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold hover:bg-canvas">Advisors</Link>
            <Link href="/pricing" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold hover:bg-canvas">Pricing</Link>
            {!signedIn && <Link href="/login" onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 font-semibold hover:bg-canvas">Log in</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
