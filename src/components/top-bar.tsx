"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { NotificationBell } from "./notification-bell";

const breadcrumbMap: Record<string, string> = {
  "/pipeline/dashboard": "Dashboard",
  "/pipeline/videos": "Video Pipeline",
  "/news/dashboard": "Dashboard",
  "/news/events": "News Pipeline",
  "/notifications": "Notifications",
};

/** Only emits crumbs for routes that actually exist. The literal "/pipeline"
 * and "/news" segments aren't pages on their own - each project's real
 * routes live at /<project>/dashboard and /<project>/videos|events - so
 * they're deliberately skipped rather than shown as a dead link. */
function getBreadcrumbs(pathname: string) {
  const breadcrumbs: { label: string; href: string }[] = [{ label: "Workspace", href: "/pipeline/dashboard" }];

  if (pathname.startsWith("/pipeline/videos")) {
    breadcrumbs.push({ label: "Video Pipeline", href: "/pipeline/videos" });
    const idMatch = pathname.match(/^\/pipeline\/videos\/([^/]+)/);
    if (idMatch) {
      breadcrumbs.push({ label: idMatch[1], href: pathname });
    }
  } else if (pathname.startsWith("/pipeline/dashboard")) {
    breadcrumbs.push({ label: "Video Pipeline", href: "/pipeline/videos" });
    breadcrumbs.push({ label: "Dashboard", href: "/pipeline/dashboard" });
  } else if (pathname.startsWith("/news/events")) {
    breadcrumbs.push({ label: "News Pipeline", href: "/news/events" });
    const idMatch = pathname.match(/^\/news\/events\/([^/]+)/);
    if (idMatch) {
      breadcrumbs.push({ label: `Event #${idMatch[1]}`, href: pathname });
    }
  } else if (pathname.startsWith("/news/dashboard")) {
    breadcrumbs.push({ label: "News Pipeline", href: "/news/events" });
    breadcrumbs.push({ label: "Dashboard", href: "/news/dashboard" });
  } else if (breadcrumbMap[pathname]) {
    breadcrumbs.push({ label: breadcrumbMap[pathname], href: pathname });
  }

  return breadcrumbs;
}

export function TopBar() {
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration-safe mounted check
  useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : true;
  const breadcrumbs = getBreadcrumbs(pathname);

  return (
    <header className="fixed left-64 right-0 top-0 h-14 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)] z-30 flex items-center justify-between px-6">
      <nav className="flex items-center gap-2" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.href} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" aria-hidden="true" />}
              {index === breadcrumbs.length - 1 ? (
                <span className="text-sm font-medium text-[var(--text)] truncate max-w-[220px]">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors truncate max-w-[150px]"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <div className="w-px h-6 bg-[var(--border)]" aria-hidden="true" />
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="btn-ghost p-2"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>
    </header>
  );
}
