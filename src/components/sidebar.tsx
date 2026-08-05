"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutGrid,
  CircleAlert,
  Clock,
  CheckCircle2,
  ClipboardCheck,
  Castle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

const NAV_ITEMS = [
  { href: "/", label: "All videos", icon: LayoutGrid, view: null },
  { href: "/?view=review", label: "Needs review", icon: ClipboardCheck, view: "review" },
  { href: "/?view=progress", label: "In progress", icon: Clock, view: "progress" },
  { href: "/?view=errors", label: "Errors", icon: CircleAlert, view: "errors" },
  { href: "/?view=done", label: "Done", icon: CheckCircle2, view: "done" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-text-on">
          <Castle className="h-4.5 w-4.5" strokeWidth={2.25} />
        </div>
        <span className="text-[15px] font-semibold tracking-tight text-text">Citadel</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === "/" && currentView === item.view;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-accent-soft text-accent"
                  : "text-text-muted hover:bg-bg hover:text-text"
              )}
              style={{ transitionTimingFunction: "var(--ease-out)" }}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-border px-4 py-4">
        <span className="text-xs text-text-faint">Video pipeline</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}

