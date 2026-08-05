"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Avoid hydration mismatch - next-themes can't know the real theme until
  // mounted client-side, so render a neutral placeholder until then.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration-safe mounted check
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent active:scale-90"
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      {mounted && (
        <>
          <Sun
            className={`absolute h-4 w-4 transition-all duration-300 ${
              isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
            }`}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          />
          <Moon
            className={`absolute h-4 w-4 transition-all duration-300 ${
              isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0"
            }`}
            style={{ transitionTimingFunction: "var(--ease-out)" }}
          />
        </>
      )}
    </button>
  );
}
