"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Share, Smartphone, X } from "lucide-react";
import { buttonClass } from "./ui";
import { cn } from "@/lib/utils";

/*
  Install ("Add to Home Screen") promotion, shared by every surface so they all agree on whether to show.

  Restraint rules:
  - Nothing shows when the app is installed or already running as the installed app.
  - Pop-in nudges (the app banner, the site pill) are phone-only, never on someone's first visit,
    at most once per visit, and each "Not now" snoozes every nudge: 7 days, then 30, then never again.
  - Quiet, in-place surfaces (cards, the sidebar link, the /install page) stay available until installed.
*/

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
declare global {
  interface Window { __bbInstall?: BIPEvent | null }
}

/** Inline script for <head>: catches Chrome's one-time install event before React has loaded. */
export const EARLY_INSTALL_CAPTURE = `window.__bbInstall=null;addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__bbInstall=e;dispatchEvent(new Event("bb:install-change"))});addEventListener("appinstalled",function(){window.__bbInstall=null;try{localStorage.setItem("bb_installed","1")}catch(_){}dispatchEvent(new Event("bb:install-change"))});`;

export type InstallMode = "installed" | "prompt" | "ios" | "unavailable";

const store = {
  get(key: string) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, v: string) { try { localStorage.setItem(key, v); } catch {} },
};

function currentMode(): InstallMode {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
  if (standalone || store.get("bb_installed") === "1") return "installed";
  if (window.__bbInstall) return "prompt";
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "unavailable";
}

function subscribe(cb: () => void) {
  window.addEventListener("bb:install-change", cb);
  return () => window.removeEventListener("bb:install-change", cb);
}

/** Can this device install BizBooks right now, and how. Server render is "unavailable" so nothing flashes. */
export function useInstall() {
  const mode = useSyncExternalStore(subscribe, currentMode, () => "unavailable" as InstallMode);
  const install = useCallback(async () => {
    const e = window.__bbInstall;
    if (!e) return "unavailable" as const;
    await e.prompt();
    const { outcome } = await e.userChoice;
    window.__bbInstall = null;
    if (outcome === "accepted") store.set("bb_installed", "1");
    window.dispatchEvent(new Event("bb:install-change"));
    return outcome;
  }, []);
  return { mode, install, canShow: mode === "prompt" || mode === "ios" };
}

/* ---------- Pacing for pop-in nudges ---------- */

const DAY = 86_400_000;

/** Counts visits (browser sessions) once each, so nudges can wait for a second visit. */
function visitCount() {
  let n = Number(store.get("bb_visits") || "0");
  try {
    if (!sessionStorage.getItem("bb_visit_counted")) {
      sessionStorage.setItem("bb_visit_counted", "1");
      n += 1;
      store.set("bb_visits", String(n));
    }
  } catch {}
  return n;
}

function nudgeAllowed() {
  const dismissed = Number(store.get("bb_install_dismissals") || "0");
  if (dismissed >= 3) return false;
  if (Number(store.get("bb_install_snooze_until") || "0") > Date.now()) return false;
  try { if (sessionStorage.getItem("bb_install_nudged")) return false; } catch {}
  return visitCount() >= 2;
}

function snoozeNudges() {
  const n = Number(store.get("bb_install_dismissals") || "0") + 1;
  store.set("bb_install_dismissals", String(n));
  store.set("bb_install_snooze_until", String(Date.now() + (n === 1 ? 7 : 30) * DAY));
}

function markNudged() {
  try { sessionStorage.setItem("bb_install_nudged", "1"); } catch {}
}

const isPhone = () => window.matchMedia("(max-width: 1023px) and (pointer: coarse)").matches;

/* ---------- Building blocks ---------- */

function IosSteps({ className }: { className?: string }) {
  return (
    <p className={cn("text-ink-soft", className)}>
      In Safari, tap <Share className="inline size-4 align-[-2px]" aria-label="Share" /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
    </p>
  );
}

/** A button that installs where the browser allows it, and links to instructions everywhere else. */
export function InstallButton({ className, size = "md", label = "Install the app", fallback }: { className?: string; size?: "sm" | "md" | "lg"; label?: string; fallback?: React.ReactNode }) {
  const { mode, install } = useInstall();
  if (mode === "installed") return <span className={cn("inline-flex items-center gap-2 text-sm font-semibold text-brand-deep", className)}>✓ Installed on this device</span>;
  if (mode === "prompt") {
    return <button type="button" onClick={install} className={buttonClass("primary", size, className)}><Download className="size-4" aria-hidden /> {label}</button>;
  }
  if (fallback !== undefined) return <>{fallback}</>;
  return <Link href="/install" className={buttonClass("primary", size, className)}><Smartphone className="size-4" aria-hidden /> How to install</Link>;
}

/** Service worker registration (production only). */
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}

/* ---------- Surfaces ---------- */

/**
 * The in-place card (dashboard, More, onboarding). Quiet: it sits in the page rather than popping up.
 * Closing it hides this card for 30 days.
 */
export function InstallPrompt({ className }: { className?: string }) {
  const { mode, install } = useInstall();
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setClosed(Number(store.get("bb_install_card_hidden_until") || "0") > Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  if (closed || (mode !== "prompt" && mode !== "ios")) return null;
  const close = () => { setClosed(true); store.set("bb_install_card_hidden_until", String(Date.now() + 30 * DAY)); };

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand-wash p-4", className)}>
      <Smartphone className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-brand-deep">Put BizBooks on your home screen</p>
        {mode === "ios" ? <IosSteps className="mt-0.5" /> : (
          <>
            <p className="mt-0.5 text-ink-soft">Opens like an app, straight to your dashboard. No app store, very little data.</p>
            <button type="button" className={buttonClass("primary", "sm", "mt-3")} onClick={install}><Download className="size-4" aria-hidden /> Install app</button>
          </>
        )}
      </div>
      <button type="button" onClick={close} aria-label="Hide for now" className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/60">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Sidebar / menu link: always there until installed, never pops up. */
export function InstallLink({ className }: { className?: string }) {
  const { mode, install } = useInstall();
  if (mode !== "prompt" && mode !== "ios") return null;
  return mode === "prompt"
    ? <button type="button" onClick={install} className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline", className)}><Download className="size-3.5" aria-hidden /> Install the app</button>
    : <Link href="/install" className={cn("inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline", className)}><Smartphone className="size-3.5" aria-hidden /> Install the app</Link>;
}

/**
 * Pop-in nudge. `variant="app"` is a slim bar above the phone's bottom menu; `variant="site"` is a small pill
 * on public pages that waits until the reader has scrolled a good way down. Paced by the rules at the top.
 */
export function InstallNudge({ variant }: { variant: "app" | "site" }) {
  const { mode, install } = useInstall();
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Pages that already show the install card or instructions don't also get the pop-in.
  const eligible = (mode === "prompt" || mode === "ios") && !["/app", "/app/more", "/install", "/onboarding/done"].includes(path);

  useEffect(() => {
    if (!eligible || !isPhone() || !nudgeAllowed()) return;
    const show = () => { markNudged(); setOpen(true); cleanup(); };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const seen = (window.scrollY + window.innerHeight) / Math.max(1, document.documentElement.scrollHeight);
      if (seen > 0.55) show();
    };
    const cleanup = () => { if (timer) clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
    if (variant === "app") timer = setTimeout(show, 6000);
    else { window.addEventListener("scroll", onScroll, { passive: true }); timer = setTimeout(show, 45000); }
    return cleanup;
  }, [eligible, variant]);

  if (!open || !eligible) return null;
  const notNow = () => { snoozeNudges(); setOpen(false); };

  return (
    <div role="region" aria-label="Install BizBooks"
      className={cn(
        "fixed z-30 flex items-center gap-3 rounded-2xl border border-line bg-paper/95 p-3 shadow-lg backdrop-blur motion-safe:animate-[bb-rise_.35s_ease-out] lg:hidden",
        variant === "app" ? "inset-x-3 bottom-[5.5rem]" : "bottom-4 left-4 right-4 sm:left-auto sm:max-w-sm",
      )}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" width={36} height={36} className="size-9 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold leading-tight">{variant === "app" ? "Add BizBooks to your home screen" : "Get the BizBooks app"}</p>
        {mode === "ios" ? <IosSteps className="text-xs" /> : <p className="text-xs text-muted">Free · no app store · opens in one tap</p>}
      </div>
      {mode === "prompt" && (
        <button type="button" onClick={async () => { setOpen(false); await install(); }} className={buttonClass("primary", "sm", "shrink-0")}>Install</button>
      )}
      <button type="button" onClick={notNow} aria-label="Not now" className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
