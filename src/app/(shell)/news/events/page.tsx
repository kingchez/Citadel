"use client";

import { useState, useMemo, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { NewsEvent } from "@/lib/news-types";
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { saveQueue } from "@/lib/news-queue-cache";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import {
  Search,
  ChevronRight,
  Clock,
  Video,
  Newspaper,
  TrendingUp,
  Film,
  Loader2,
  Check,
  AlertTriangle,
  Play,
  RotateCcw,
  X,
  ExternalLink,
} from "lucide-react";

interface HighlightReel {
  batch_id: string;
  status: "processing" | "ready" | "approved" | "failed";
  drive_file_id: string | null;
  drive_url: string | null;
  error_message: string | null;
  updated_at: string;
}

const TABS = [
  { key: "all", label: "All" },
  { key: "final_review", label: "Final Reviews" },
  { key: "reviewed", label: "Reviewed" },
  { key: "scheduled", label: "Scheduled" },
  { key: "paused", label: "Paused" },
];

function matchesView(event: NewsEvent, view: string): boolean {
  switch (view) {
    case "final_review":
      return event.status === "final_review";
    case "reviewed":
      return event.status === "reviewed";
    case "scheduled":
      return event.status === "scheduled";
    case "paused":
      return event.status === "paused";
    default:
      return true;
  }
}

function EventRow({ event }: { event: NewsEvent }) {
  const color = EVENT_STATUS_COLORS[event.status] || "cyan";
  return (
    <Link
      href={`/news/events/${event.id}`}
      className="group flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-all duration-150"
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: `var(--color-${color})`, boxShadow: `0 0 6px var(--color-${color}-glow)` }}
      />

      <div className="flex-1 min-w-[calc(100%-2.25rem)] sm:min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text)] line-clamp-2 sm:truncate">
            {event.social_headline || event.event_title || `Event #${event.id}`}
          </h3>
          {event.video_id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-green-soft)] text-[var(--color-green)] border border-[var(--color-green)]/30 flex-shrink-0">
              <Video className="w-3 h-3" />
              Video
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          {event.global_relevance_score != null && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {event.global_relevance_score.toFixed(1)}
            </span>
          )}
          {event.golden_window_hours != null && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {event.golden_window_hours}h window
              </span>
            </>
          )}
          {event.batch_id && (
            <>
              <span>·</span>
              <span className="font-mono text-[10px] text-[var(--text-faint)] bg-[var(--surface-raised)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                {event.batch_id}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex-shrink-0 max-sm:ml-7">
        <span className={`badge badge-${color} text-[10px]`}>{EVENT_STATUS_LABELS[event.status] || event.status}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 max-sm:ml-auto">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(event.created_at)}</span>
        <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors" />
      </div>
    </Link>
  );
}

function EventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("view") || "all";
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [highlightReels, setHighlightReels] = useState<HighlightReel[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [dismissedErrorAt, setDismissedErrorAt] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("view");
    else params.set("view", tab);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const load = useCallback(() => {
    fetch("/api/news/events")
      .then((r) => r.json())
      .then((data: { events?: NewsEvent[]; highlightReels?: HighlightReel[] }) => {
        const list = data.events || [];
        setEvents(list);
        setHighlightReels(data.highlightReels || []);
        saveQueue(list.map((e) => ({ id: e.id, social_headline: e.social_headline, event_title: e.event_title })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(load, 10000);

  const { readyBatches, maxStaticCount } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.batch_id && e.status === "scheduled" && e.post_format === "static") {
        counts.set(e.batch_id, (counts.get(e.batch_id) || 0) + 1);
      }
    }
    const eligible: string[] = [];
    let maxCount = 0;
    for (const [batchId, count] of counts.entries()) {
      if (count > maxCount) maxCount = count;
      if (count >= 8) {
        eligible.push(batchId);
      }
    }
    // Sort unapproved batches first so approved batches automatically yield the queue
    const reelMap = new Map(highlightReels.map((r) => [r.batch_id, r]));
    eligible.sort((a, b) => {
      const aApproved = reelMap.get(a)?.status === "approved" ? 1 : 0;
      const bApproved = reelMap.get(b)?.status === "approved" ? 1 : 0;
      return aApproved - bApproved;
    });
    return { readyBatches: eligible, maxStaticCount: maxCount };
  }, [events, highlightReels]);

  const readyBatchId = useMemo(() => {
    if (selectedBatchId && readyBatches.includes(selectedBatchId)) {
      return selectedBatchId;
    }
    return readyBatches[0] || null;
  }, [selectedBatchId, readyBatches]);

  const activeReel = useMemo(
    () => (readyBatchId ? highlightReels.find((r) => r.batch_id === readyBatchId) || null : null),
    [readyBatchId, highlightReels]
  );

  const isStaleProcessing = useMemo(() => {
    if (activeReel?.status !== "processing" || !activeReel.updated_at) return false;
    return Date.now() - new Date(activeReel.updated_at).getTime() > 4 * 60 * 1000;
  }, [activeReel]);

  const triggerHighlightReel = async () => {
    if (!readyBatchId || submitting) return;
    setSubmitting(true);
    setAlertError(null);
    setDismissedErrorAt(null);
    setPreviewOpen(false);
    try {
      const res = await fetch("/api/news/events/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: readyBatchId, action: "trigger" }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to trigger highlight reel");
      }
      load();
    } catch (err) {
      setAlertError(err instanceof Error ? err.message : "Highlight reel failed");
    } finally {
      setSubmitting(false);
    }
  };

  const approveHighlightReel = async () => {
    if (!readyBatchId || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/news/events/highlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: readyBatchId, action: "approve" }),
      });
      setPreviewOpen(false);
      // Advance selection to next unapproved batch if available
      const nextUnapproved = readyBatches.find(
        (b) => b !== readyBatchId && highlightReels.find((r) => r.batch_id === b)?.status !== "approved"
      );
      if (nextUnapproved) setSelectedBatchId(nextUnapproved);
      load();
    } finally {
      setSubmitting(false);
    }
  };

  const isProcessing = submitting || (activeReel?.status === "processing" && !isStaleProcessing);
  const isVideoReady = activeReel?.status === "ready" && Boolean(activeReel.drive_file_id);
  const isApproved = activeReel?.status === "approved";

  const visibleError =
    alertError ||
    (activeReel?.status === "failed" && dismissedErrorAt !== activeReel.updated_at
      ? activeReel.error_message || "Highlight reel generation failed."
      : isStaleProcessing && dismissedErrorAt !== activeReel?.updated_at
      ? "Highlight reel timed out while rendering. Click Generate Highlight Reel to retry."
      : null);

  const handleButtonClick = () => {
    if (!readyBatchId || isProcessing) return;
    if (isVideoReady) {
      setPreviewOpen(true);
      return;
    }
    triggerHighlightReel();
  };

  const filtered = useMemo(() => {
    let list = events.filter((e) => matchesView(e, activeTab));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.social_headline || "").toLowerCase().includes(q) ||
          (e.event_title || "").toLowerCase().includes(q) ||
          String(e.id).includes(q)
      );
    }
    return list;
  }, [events, activeTab, search]);

  const tabCounts = useMemo(
    () => ({
      all: events.length,
      final_review: events.filter((e) => matchesView(e, "final_review")).length,
      reviewed: events.filter((e) => matchesView(e, "reviewed")).length,
      scheduled: events.filter((e) => matchesView(e, "scheduled")).length,
      paused: events.filter((e) => matchesView(e, "paused")).length,
    }),
    [events]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-[var(--color-cyan)]" />
            News Events
          </h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{events.length} total events</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {readyBatches.length > 1 && (
            <select
              value={readyBatchId || ""}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-xs font-mono bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] focus:outline-none"
              aria-label="Select ready batch"
            >
              {readyBatches.map((b) => {
                const st = highlightReels.find((r) => r.batch_id === b)?.status;
                return (
                  <option key={b} value={b}>
                    {b} {st ? `(${st})` : "(pending)"}
                  </option>
                );
              })}
            </select>
          )}

          <button
            type="button"
            disabled={!readyBatchId || isProcessing}
            onClick={handleButtonClick}
            title={
              !readyBatchId
                ? `Requires 8 scheduled static events in the same batch (${maxStaticCount}/8 ready)`
                : isVideoReady
                ? "Click to preview the generated News Highlight Reel"
                : `Generate 9-slide News Highlight Reel for batch ${readyBatchId}`
            }
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-150 border ${
              isVideoReady
                ? "bg-[var(--color-green)] hover:opacity-90 text-black border-transparent shadow-sm cursor-pointer"
                : readyBatchId && !isProcessing
                ? "bg-[var(--color-purple)] hover:opacity-90 text-white border-transparent shadow-sm cursor-pointer"
                : "bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border)] opacity-60 cursor-not-allowed"
            }`}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isVideoReady ? (
              <Play className="w-4 h-4 fill-current" />
            ) : isApproved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Film className="w-4 h-4" />
            )}
            {isProcessing
              ? "Rendering Highlight..."
              : isVideoReady
              ? "Highlight Reel Ready · Preview"
              : isApproved
              ? "Highlight Approved (Regenerate)"
              : readyBatchId
              ? "Generate Highlight Reel"
              : `Highlight Reel (${maxStaticCount}/8)`}
          </button>
        </div>
      </div>

      {visibleError && (
        <div className="flex items-start justify-between gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{visibleError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setAlertError(null);
              if (activeReel?.updated_at) setDismissedErrorAt(activeReel.updated_at);
            }}
            className="text-red-400 hover:text-red-200"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit max-w-full scroll-x">
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
          placeholder="Search by headline or event ID..."
          className="input-field pl-11 py-3"
        />
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
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No events found</p>
          </div>
        ) : (
          filtered.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>

      {previewOpen && activeReel?.drive_file_id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--surface)] border border-[var(--border-strong)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text)]">News Highlight Reel Preview</h2>
                <p className="text-[11px] text-[var(--text-faint)] font-mono">{activeReel.batch_id}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 rounded-lg text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-raised)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-black flex justify-center">
              <video
                src={`/api/drive/${activeReel.drive_file_id}`}
                controls
                autoPlay
                playsInline
                className="w-full max-h-[65vh] rounded-xl"
              />
            </div>

            <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-[var(--border)] bg-[var(--surface-raised)]">
              {activeReel.drive_url ? (
                <a
                  href={activeReel.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text)]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open in Drive
                </a>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={triggerHighlightReel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[var(--border-strong)] text-[var(--text)] hover:bg-[var(--surface)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Redo
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={approveHighlightReel}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--color-green)] text-black hover:opacity-90 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Keep It
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewsEventsPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 text-[var(--text-faint)]">Loading...</div>}>
      <EventsContent />
    </Suspense>
  );
}
