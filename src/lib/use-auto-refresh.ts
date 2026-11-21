"use client";

import { useEffect, useRef } from "react";

/**
 * Periodically invokes `onRefresh` while the browser tab is visible,
 * and immediately invokes it when the tab becomes visible or regains focus.
 */
export function useAutoRefresh(onRefresh: () => void, intervalMs = 10000, enabled = true) {
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      cbRef.current();
    };

    const timer = setInterval(tick, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") cbRef.current();
    };
    const onFocus = () => cbRef.current();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalMs, enabled]);
}
