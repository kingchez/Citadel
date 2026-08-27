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
  "/notifications": "Notifications",
};

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const breadcrumbs = [{ label: "Workspace", href: "/pipeline/dashboard" }];
  let currentPath = "";
  for (const part of parts) {
    currentPath += `/${part}`;
    const label = breadcrumbMap[currentPath] || part.charAt(0).toUpperCase() + part.slice(1);
    breadcrumbs.push({ label, href: currentPath });
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
