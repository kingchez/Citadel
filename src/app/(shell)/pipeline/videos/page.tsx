"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { VideoRow } from "@/lib/types";
import { hasAnyError, isInProgress, needsReview, isDone } from "@/lib/video-stats";
import { StatusBadge, StatusDot } from "@/components/status-badge";
import { formatTimeAgo } from "@/lib/utils";
import { Search, ChevronRight, AlertTriangle, Tag, Film } from "lucide-react";

const TABS = [
  { key: "all", label: "All" },
  { key: "errors", label: "Errors" },
  { key: "progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "done", label: "Done" },
];

function matchesView(video: VideoRow, view: string): boolean {
  switch (view) {
    case "errors":
      return hasAnyError(video);
    case "progress":
      return isInProgress(video);
    case "review":
      return needsReview(video);
    case "done":
      return isDone(video);
    default:
      return true;
  }
}

function getErrorCount(video: VideoRow): number {
  return (video.script_segments || []).filter((s) => !!s.error).length;
}

function VideoRowItem({ video }: { video: VideoRow }) {
  const errorCount = getErrorCount(video);
  const hasError = video.status === "render_error" || errorCount > 0;

  return (
    <Link
      href={`/pipeline/videos/${video.id}`}
      className="group flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-all duration-150"
    >
      <StatusDot status={video.status} size="md" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text)] truncate">{video.title}</h3>
          {hasError && errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-red-soft)] text-[var(--color-red)] border border-[var(--color-red)]/30 flex-shrink-0">
              <AlertTriangle className="w-3 h-3" />
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{video.channel}</span>
          {video.with_product && (
            <>
              <span>·</span>
              <span className="text-[var(--color-purple)]">
                <Tag className="w-3 h-3 inline mr-0.5" />
                Affiliate
              </span>
            </>
          )}
          <span>·</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
            {video.id}
          </span>
        </p>
      </div>

      <div className="flex-shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">
          <Film className="w-3.5 h-3.5" />
          {video.video_type === "vertical-shorts" ? "Vertical" : "Horizontal"}
        </span>
      </div>

      <div className="flex-shrink-0">
        <StatusBadge status={video.status} size="sm" showIcon={false} />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(video.updated_at)}</span>
        <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors" />
      </div>
    </Link>
  );
}

function VideosContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("view") || "all";
  const [search, setSearch] = useState("");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("view");
    else params.set("view", tab);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    fetch("/api/videos")
      .then((r) => r.json())
      .then((data: { videos?: VideoRow[] }) => setVideos(data.videos || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = videos.filter((v) => matchesView(v, activeTab));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.channel.toLowerCase().includes(q) ||
          v.status.toLowerCase().includes(q) ||
          v.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [videos, activeTab, search]);

  const tabCounts = useMemo(
    () => ({
      all: videos.length,
      errors: videos.filter((v) => matchesView(v, "errors")).length,
      progress: videos.filter((v) => matchesView(v, "progress")).length,
      review: videos.filter((v) => matchesView(v, "review")).length,
      done: videos.filter((v) => matchesView(v, "done")).length,
    }),
    [videos]
  );

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">Video Pipeline</h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{videos.length} total items across all stages</p>
        </div>
      </div>

      <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit overflow-x-auto">
        {TABS.map((tab) => {
          const count = tabCounts[tab.key as keyof typeof tabCounts];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab flex items-center gap-2 ${activeTab === tab.key ? "tab-active" : ""}`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-[var(--border)] text-[var(--text-faint)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, channel, status, or database ID..."
          className="input-field pl-11 py-3"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)] text-sm">
            ✕
          </button>
        )}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-faint)]">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No videos found</p>
            <p className="text-sm mt-1 opacity-60">{search ? "Try adjusting your search query" : "This category is currently empty"}</p>
          </div>
        ) : (
          filtered.map((video) => <VideoRowItem key={video.id} video={video} />)
        )}
      </div>
    </div>
  );
}

export default function VideosPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-faint)]">Loading...</div>}>
      <VideosContent />
    </Suspense>
  );
}
