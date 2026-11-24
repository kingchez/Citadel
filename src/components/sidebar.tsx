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
  Eye,
  ListChecks,
  LayoutTemplate,
  Plus,
  Repeat,
  CalendarClock,
  PackageCheck,
  FileText,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useNav } from "@/components/nav-context";
import type { VideoRow } from "@/lib/types";
import type { NewsEvent } from "@/lib/news-types";
import type { ArticleRow } from "@/lib/article-types";
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
      { label: "All Videos", href: "/pipeline/videos", icon: Grid },
      { label: "Errors", href: "/pipeline/videos?view=errors", icon: AlertTriangle, countKey: "video.errors" },
      { label: "In Progress", href: "/pipeline/videos?view=progress", icon: Clock, countKey: "video.progress" },
      { label: "Needs Review", href: "/pipeline/videos?view=review", icon: ClipboardCheck, countKey: "video.review" },
      { label: "Done", href: "/pipeline/videos?view=done", icon: CheckCircle, countKey: "video.done" },
      { label: "Add Video", href: "/pipeline/new", icon: Plus },
      { label: "Repurpose Queue", href: "/pipeline/repurpose", icon: Repeat, countKey: "repurpose.active" },
      { label: "Product Clips", href: "/pipeline/products", icon: PackageCheck },
    ],
  },
  {
    key: "articles-pipeline",
    label: "Articles & Posts",
    icon: FileText,
    items: [
      { label: "All Articles", href: "/pipeline/posts", icon: Grid },
      { label: "Needs Review", href: "/pipeline/posts?view=review", icon: ClipboardCheck, countKey: "article.review" },
      { label: "Final Reviews", href: "/pipeline/posts?view=final_review", icon: Eye, countKey: "article.finalReview" },
      { label: "Revisions", href: "/pipeline/posts?view=revisions", icon: AlertTriangle, countKey: "article.revisions" },
      { label: "Published", href: "/pipeline/posts?view=published", icon: CheckCircle, countKey: "article.published" },
      { label: "Weekly Topics", href: "/pipeline/posts/topics", icon: Sparkles },
    ],
  },
  {
    key: "news-pipeline",
    label: "News Pipeline",
    icon: Newspaper,
    items: [
      { label: "Trend Review", href: "/news/review", icon: ListChecks, countKey: "news.trendReview" },
      { label: "All Events", href: "/news/events", icon: Grid },
      { label: "Final Reviews", href: "/news/events?view=final_review", icon: Inbox, countKey: "news.finalReview" },
      { label: "Reviewed", href: "/news/events?view=reviewed", icon: CheckCircle, countKey: "news.reviewed" },
    ],
  },
];

export function Sidebar() {
  const { open: navOpen, closeNav } = useNav();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration-safe mounted check
    setMounted(true);

    try {
      const saved = localStorage.getItem("citadel_expanded_projects");
      if (saved) {
        setExpandedProjects(JSON.parse(saved));
      }
    } catch {}

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

    fetch("/api/articles")
      .then((r) => r.json())
      .then((data: { articles?: ArticleRow[] }) => {
        const arts = data.articles || [];
        setCounts((prev) => ({
          ...prev,
          "article.review": arts.filter((a) => a.status === "review_ready").length,
          "article.finalReview": arts.filter((a) => a.status === "final_review").length,
          "article.revisions": arts.filter((a) => a.status === "revision_requested").length,
          "article.published": arts.filter((a) => a.status === "published").length,
        }));
      })
      .catch(() => {});

    fetch("/api/repurpose")
      .then((r) => r.json())
      .then((data: { items?: { status: string }[] }) => {
        const active = (data.items || []).filter((i) => i.status !== "handed_off" && i.status !== "cancelled").length;
        setCounts((prev) => ({ ...prev, "repurpose.active": active }));
      })
      .catch(() => {});

    fetch("/api/news/trends")
      .then((r) => r.json())
      .then((data: { trends?: unknown[] }) => {
        setCounts((prev) => ({ ...prev, "news.trendReview": (data.trends || []).length }));
      })
      .catch(() => {});

    fetch("/api/news/events")
      .then((r) => r.json())
      .then((data: { events?: NewsEvent[] }) => {
        const events = data.events || [];
        setCounts((prev) => ({
          ...prev,
          "news.finalReview": events.filter((e) => e.status === "final_review").length,
          "news.reviewed": events.filter((e) => e.status === "reviewed").length,
        }));
      })
      .catch(() => {});
  }, []);

  const toggleProject = (key: string) => {
    setExpandedProjects((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem("citadel_expanded_projects", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (pathname !== path) return false;
    if (!query) return !searchParams.get("view");
    const targetView = new URLSearchParams(query).get("view");
    return searchParams.get("view") === targetView;
  };

  const handleLogout = async () => {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <>
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeNav}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-dvh w-64 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col transition-transform duration-200 md:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-3" aria-label="Citadel Dashboard">
            <div className="relative p-2 rounded-xl bg-[var(--color-purple-soft)] glow-purple">
              <Castle className="w-6 h-6 text-[var(--color-purple)]" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[var(--text)]">Citadel</span>
              <p className="text-[11px] text-[var(--text-faint)]">Content & Automation</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
            Command Center
          </div>

          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              pathname === "/"
                ? "bg-[var(--color-purple-soft)] text-[var(--text)] glow-purple"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
            )}
          >
            <LayoutDashboard className={cn("w-4 h-4", pathname === "/" && "text-[var(--color-purple)]")} />
            <span>Dashboard</span>
          </Link>

          <Link
            href="/schedule"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              pathname === "/schedule"
                ? "bg-[var(--color-purple-soft)] text-[var(--text)] glow-purple"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
            )}
          >
            <CalendarClock className={cn("w-4 h-4", pathname === "/schedule" && "text-[var(--color-purple)]")} />
            <span>Schedule</span>
          </Link>

          <Link
            href="/templates"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
              pathname === "/templates"
                ? "bg-[var(--color-purple-soft)] text-[var(--text)] glow-purple"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
            )}
          >
            <LayoutTemplate className={cn("w-4 h-4", pathname === "/templates" && "text-[var(--color-purple)]")} />
            <span>Templates</span>
          </Link>

          <div className="px-2 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] flex items-center gap-1.5">
            <FolderKanban className="w-3 h-3" />
            Pipelines
          </div>

          {PROJECTS.map((project) => {
            const expanded = expandedProjects.includes(project.key);
            const ProjectIcon = project.icon;
            return (
              <div key={project.key} className="space-y-0.5">
                <button
                  onClick={() => toggleProject(project.key)}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-[var(--text)] hover:bg-[var(--surface-raised)] transition-colors"
                >
                  <ProjectIcon className="w-4.5 h-4.5 text-[var(--color-purple)] flex-shrink-0" />
                  <span className="flex-1 text-left truncate">{project.label}</span>
                  <ChevronDown
                    className={cn("w-4 h-4 text-[var(--text-faint)] transition-transform duration-150", expanded && "rotate-180")}
                  />
                </button>

                {expanded && (
                  <div className="pl-4 space-y-0.5">
                    {project.items.map((item) => {
                      const active = isActive(item.href);
                      const Icon = item.icon;
                      const count = item.countKey ? counts[item.countKey] : undefined;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                            active
                              ? "bg-[var(--color-purple-soft)] text-[var(--text)]"
                              : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)]"
                          )}
                        >
                          <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-[var(--color-purple)]")} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {!!count && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-purple)] text-white min-w-[18px] text-center">
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
        </nav>

        <div className="p-3 border-t border-[var(--border)] space-y-1">
          <button
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] hover:text-[var(--text)] transition-all duration-150"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="w-4 h-4 text-[var(--color-amber)]" /> : <Moon className="w-4 h-4 text-[var(--color-purple)]" />}
            <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--color-red-soft)] hover:text-[var(--color-red)] transition-all duration-150"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
