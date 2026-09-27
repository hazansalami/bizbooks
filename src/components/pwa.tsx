"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { buttonClass } from "./ui";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Install the app" card. Android/Chrome gets the native prompt; iPhone gets the
 * Share → Add to Home Screen instruction, since Safari has no install event.
 */
export function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("bb_install_dismissed") === "1";
    } catch {}
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    // Defer the iOS reveal so it doesn't set state synchronously during the effect.
    const t = isIos ? setTimeout(() => { setIos(true); setHidden(false); }, 0) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) clearTimeout(t);
    };
  }, []);

  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem("bb_install_dismissed", "1");
    } catch {}
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand-wash p-4">
      <Download className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold text-brand-deep">Put BizBooks on your home screen</p>
        {ios ? (
          <p className="mt-0.5 text-ink-soft">In Safari, tap the Share button, then “Add to Home Screen”. It opens like an app, no app store needed.</p>
        ) : (
          <>
            <p className="mt-0.5 text-ink-soft">Opens like an app and uses very little data. No app store needed.</p>
            <button
              type="button"
              className={buttonClass("primary", "sm", "mt-3")}
              onClick={async () => {
                if (!event) return;
                await event.prompt();
                await event.userChoice;
                setHidden(true);
              }}
            >
              Install app
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/60">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
