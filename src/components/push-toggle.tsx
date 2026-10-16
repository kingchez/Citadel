"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";

type State = "checking" | "unsupported" | "blocked" | "off" | "on";

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const raw = atob((base64Url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const supported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

async function saveSubscription(sub: PushSubscription) {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Couldn't save this phone.");
}

async function detect(): Promise<{ state: State; sub: PushSubscription | null }> {
  if (!supported()) return { state: "unsupported", sub: null };
  if (Notification.permission === "denied") return { state: "blocked", sub: null };
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  return sub && Notification.permission === "granted" ? { state: "on", sub } : { state: "off", sub: null };
}

/** "Enable notifications" control for the Home page: turns this phone's alerts on/off and sends a test. */
export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detect().then(({ state: next, sub }) => {
      if (cancelled) return;
      setState(next);
      if (sub) saveSubscription(sub).catch(() => {}); // keep the server's copy in sync (e.g. if it was cleaned up)
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) }));
      await saveSubscription(sub);
      setState("on");
      setNote("Phone alerts are on. Tap “Send test” to check.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await fetch("/api/push/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      setNote(res.ok ? "Test sent. It should pop up in a few seconds." : d.error || "Test failed.");
    } catch {
      setNote("Network error.");
    } finally {
      setBusy(false);
    }
  };

  if (state === "checking" || state === "unsupported") return null;

  if (state === "blocked") {
    return (
      <div className="rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-soft)] px-4 py-3 text-sm text-[var(--color-amber)] flex items-center gap-2">
        <BellOff className="w-4 h-4 flex-shrink-0" />
        Notifications are blocked for Citadel. Allow them in your phone&apos;s app or site settings, then reload.
      </div>
    );
  }

  if (state === "off") {
    return (
      <div className="rounded-xl border border-[var(--color-purple)] bg-[var(--color-purple-soft)] px-4 py-3 flex flex-wrap items-center gap-3">
        <BellRing className="w-5 h-5 text-[var(--color-purple)] flex-shrink-0" />
        <p className="text-sm text-[var(--text)] flex-1 min-w-[12rem]">Get schedule and alert notifications on this phone, like any other app.</p>
        <button onClick={enable} disabled={busy} className="btn-primary text-sm inline-flex items-center gap-2 disabled:opacity-50">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          Enable notifications
        </button>
        {note && <p className="w-full text-xs text-[var(--text-muted)]">{note}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-faint)]">
      <span className="inline-flex items-center gap-1.5 text-[var(--color-green)]">
        <BellRing className="w-3.5 h-3.5" />
        Phone alerts on
      </span>
      <button onClick={sendTest} disabled={busy} className="hover:text-[var(--text)] underline-offset-2 hover:underline disabled:opacity-50">
        Send test
      </button>
      <button onClick={disable} disabled={busy} className="hover:text-[var(--text)] underline-offset-2 hover:underline disabled:opacity-50">
        Turn off
      </button>
      {note && <span className="text-[var(--text-muted)]">{note}</span>}
    </div>
  );
}
