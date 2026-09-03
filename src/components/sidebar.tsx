"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Castle,
  Grid,
  AlertTriangle,
  Clock,
  ClipboardCheck,
  CheckCircle,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  LayoutDashboard,
  Video,
  FolderKanban,
  Newspaper,
  Inbox,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import type { VideoRow } from "@/lib/types";
import type { NewsEvent } from "@/lib/news-types";
import { computeVideoCounts } from "@/lib/video-stats";

interface ProjectDef {
  key: string;
  label: string;
  icon: typeof Video;
  items: { label: string; href: string; icon: typeof Grid; countKey?: string }[];
}

const PROJECTS: ProjectDef[] = [
  {
    key: "video-pipeline",
    label: "Video Pipeline",
    icon: Video,
    items: [
      { label: "Dashboard", href: "/pipeline/dashboard", icon: LayoutDashboard },
      { label: "All Videos", href: "/pipeline/videos", icon: Grid },
      { label: "Errors", href: "/pipeline/videos?view=errors", icon: AlertTriangle, countKey: "video.errors" },
      { label: "In Progress", href: "/pipeline/videos?view=progress", icon: Clock, countKey: "video.progress" },
      { label: "Needs Review", href: "/pipeline/videos?view=review", icon: ClipboardCheck, countKey: "video.review" },
      { label: "Done", href: "/pipeline/videos?view=done", icon: CheckCircle, countKey: "video.done" },
    ],
  },
  {
    key: "news-pipeline",
    label: "News Pipeline",
    icon: Newspaper,
    items: [
      { label: "Dashboard", href: "/news/dashboard", icon: LayoutDashboard },
      { label: "All Events", href: "/news/events", icon: Grid },
      { label: "Needs Review", href: "/news/events?view=needs_review", icon: Inbox, countKey: "news.needsReview" },
      { label: "Reviewed", href: "/news/events?view=reviewed", icon: CheckCircle, countKey: "news.reviewed" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<string[]>(["video-pipeline", "news-pipeline"]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration-safe mounted check
    setMounted(true);

    fetch("/api/videos")
      .then((r) => r.json())
      .then((data: { videos?: VideoRow[] }) => {
        const videoCounts = computeVideoCounts(data.videos || []);
        setCounts((prev) => ({
          ...prev,
          "video.errors": videoCounts.errors,
          "video.progress": videoCounts.progress,
          "video.review": videoCounts.review,
          "video.done": videoCounts.done,
        }));
      })
      .catch(() => {});

    fetch("/api/news/events")
      .then((r) => r.json())
      .then((data: { events?: NewsEvent[] }) => {
        const events = data.events || [];
        setCounts((prev) => ({
          ...prev,
          "news.needsReview": events.filter((e) => e.status === "unprocessed" || e.status === "processing").length,
          "news.reviewed": events.filter((e) => e.status === "reviewed").length,
        }));
      })
      .catch(() => {});
  }, []);

  const toggleProject = (key: string) => {
    setExpandedProjects((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    if (!query) return !searchParams.get("view");
    const view = new URLSearchParams(query).get("view");
    return searchParams.get("view") === view;
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[var(--bg)] border-r border-[var(--border)] flex flex-col overflow-y-auto z-40">
      {/* Logo Area */}
      <div className="p-5 border-b border-[var(--border)]">
        <Link href="/pipeline/dashboard" className="flex items-center gap-3" aria-label="Citadel Home">
          <div className="relative p-2 rounded-xl bg-[var(--color-purple-soft)] glow-purple">
            <Castle className="w-6 h-6 text-[var(--color-purple)]" />
            <div className="absolute inset-0 rounded-xl bg-[var(--color-purple)]/30 blur-xl animate-pulse-glow" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-widest text-[var(--text)]">CITADEL</span>
            <span className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider block mt-0.5">
              Command Center
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Workspace
        </div>

        <div className="pl-1 space-y-1">
          <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            <FolderKanban className="w-3.5 h-3.5" />
            Projects
          </div>

          {PROJECTS.map((project) => {
            const ProjectIcon = project.icon;
            const expanded = expandedProjects.includes(project.key);
            return (
              <div key={project.key} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => toggleProject(project.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-raised)] transition-all duration-150"
                  aria-expanded={expanded}
                >
                  <ProjectIcon className="w-4.5 h-4.5 text-[var(--color-purple)] flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{project.label}</span>
                  <ChevronDown
                    className={cn(
                      "w-4 h-4 text-[var(--text-faint)] transition-transform duration-200",
                      expanded && "rotate-180"
                    )}
                  />
                </button>

                {expanded && (
                  <div className="pl-3 space-y-0.5 animate-slide-down border-l border-[var(--border)] ml-4">
                    {project.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      const count = item.countKey ? counts[item.countKey] : undefined;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150 sidebar-item",
                            active
                              ? "bg-[var(--surface-raised)] text-[var(--text)] border-l-2 border-[var(--color-purple)] -ml-px"
                              : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-[var(--color-purple)]")} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {!!count && (
                            <span
                              className={cn(
                                "badge text-[10px] px-2 py-0.5",
                                active ? "badge-purple" : "badge-gray"
                              )}
                            >
                              {count}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Future projects placeholder */}
          <div className="px-3 py-2.5 rounded-xl bg-[var(--surface-raised)]/50 border border-[var(--border)] text-center text-xs text-[var(--text-faint)] mt-2">
            More projects will appear here
          </div>
        </div>
      </nav>

      {/* Bottom: Theme toggle + Logout */}
      <div className="p-3 border-t border-[var(--border)] space-y-2">
        <button
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-all duration-150"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--color-red-soft)] hover:text-[var(--color-red)] border border-transparent hover:border-[var(--color-red)]/30 transition-all duration-150"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
