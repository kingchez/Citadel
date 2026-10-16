"use client";

import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";

/** Chrome's "install this app" event (not in the standard TypeScript DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "citadel-install-dismissed";
const HIDE_DAYS = 7;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < HIDE_DAYS * 24 * 3600 * 1000;
  } catch {
    return false;
  }
}

/**
 * "Install Citadel" bar for phones. Shows only when the browser says the app can be installed
 * (so never inside the installed app, and never on browsers that can't install it), on a small screen,
 * and not within a week of tapping "Not now". Lives in the root layout, so it also shows on the login page.
 */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // keep the browser's own mini-bar away; we show ours
      deferred.current = e as BeforeInstallPromptEvent;
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const phoneSized = window.matchMedia("(max-width: 768px)").matches;
      if (!standalone && phoneSized && !recentlyDismissed()) setVisible(true);
    };
    const onInstalled = () => {
      deferred.current = null;
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    const evt = deferred.current;
    if (!evt) return;
    setVisible(false);
    await evt.prompt();
    await evt.userChoice.catch(() => null);
    deferred.current = null;
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode etc. - it just may show again next visit */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Citadel"
      className="fixed inset-x-3 bottom-3 z-[70] rounded-2xl border border-[var(--color-purple)] bg-[var(--surface)] shadow-2xl p-3.5 flex items-center gap-3"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" className="w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text)]">Install the Citadel app</p>
        <p className="text-xs text-[var(--text-muted)]">One tap from your home screen, plus phone alerts.</p>
      </div>
      <button onClick={install} className="btn-primary text-sm inline-flex items-center gap-1.5 flex-shrink-0">
        <Download className="w-4 h-4" />
        Install
      </button>
      <button onClick={dismiss} className="btn-ghost p-1.5 flex-shrink-0" aria-label="Not now">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
