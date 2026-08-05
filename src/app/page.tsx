"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RefreshCw, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import {
  ERROR_STATUSES,
  IN_PROGRESS_STATUSES,
  REVIEW_STATUSES,
  type VideoRow,
} from "@/lib/types";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="px-8 py-10 text-sm text-text-muted">Loading…</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  const [videos, setVideos] = useState<VideoRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/videos");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load videos");
      setVideos(json.videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load videos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!videos) return [];
    if (view === "review") return videos.filter((v) => REVIEW_STATUSES.includes(v.status));
    if (view === "progress") return videos.filter((v) => IN_PROGRESS_STATUSES.includes(v.status));
    if (view === "errors") return videos.filter((v) => ERROR_STATUSES.includes(v.status));
    if (view === "done") return videos.filter((v) => v.status === "done" || v.status === "shipped");
    return videos;
  }, [videos, view]);

  const title =
    view === "review"
      ? "Needs review"
      : view === "progress"
      ? "In progress"
      : view === "errors"
      ? "Errors"
      : view === "done"
      ? "Done"
      : "All videos";

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
          <p className="mt-1 text-sm text-text-muted">
            {loading ? "Loading…" : `${filtered.length} video${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted transition-colors duration-150 hover:bg-accent-soft hover:text-accent active:scale-90"
          style={{ transitionTimingFunction: "var(--ease-out)" }}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-text-faint">
          Nothing here right now.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((video) => (
          <VideoRowCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}

function VideoRowCard({ video }: { video: VideoRow }) {
  const errorCount = countErrors(video);

  return (
    <Link
      href={`/videos/${video.id}`}
      className="group flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 transition-all duration-150 hover:border-border-strong hover:shadow-md"
      style={{ transitionTimingFunction: "var(--ease-out)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <h3 className="truncate text-[14.5px] font-medium text-text">{video.title}</h3>
          <StatusBadge status={video.status} />
          {errorCount > 0 && (
            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              {errorCount} error{errorCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-text-muted">
          {video.channel} · {video.video_type === "horizontal-long" ? "Horizontal" : "Vertical"}
        </p>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-150 group-hover:translate-x-0.5"
        style={{ transitionTimingFunction: "var(--ease-out)" }}
      />
    </Link>
  );
}

function countErrors(video: VideoRow): number {
  let count = 0;
  for (const seg of video.script_segments ?? []) if (seg.error) count++;
  for (const clip of video.voice_timing ?? []) if (clip.error) count++;
  for (const asset of Object.values(video.media_assets ?? {})) {
    if (asset.status === "error") count++;
  }
  if (video.status === "render_error") count++;
  return count;
}
