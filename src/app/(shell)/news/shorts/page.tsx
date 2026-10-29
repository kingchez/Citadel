"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { NewsShort } from "@/lib/news-types";
import { NEWS_SHORT_STATUS_COLORS, NEWS_SHORT_STATUS_LABELS, formatTimecode, mediaDuration } from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { Film, Loader2, RotateCcw } from "lucide-react";

function summarize(short: NewsShort): string {
  const media = short.media || [];
  const clips = media.filter((m) => m.type === "clip").length;
  const images = media.length - clips;
  const parts = [];
  if (clips) parts.push(`${clips} clip${clips === 1 ? "" : "s"}`);
  if (images) parts.push(`${images} image${images === 1 ? "" : "s"}`);
  const total = media.length ? ` · about ${formatTimecode(mediaDuration(media))}` : "";
  return parts.join(", ") + total;
}

export default function NewsShortsPage() {
  const [shorts, setShorts] = useState<NewsShort[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/news/shorts")
      .then((r) => r.json())
      .then((data: { shorts?: NewsShort[] }) => setShorts(data.shorts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      const res = await fetch(`/api/news/shorts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not retry.");
      setFeedback("Back in the queue.");
      load();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Could not retry.");
    } finally {
      setRetrying(null);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Film className="w-5 h-5 text-[var(--color-purple)]" />
        <h1 className="text-lg font-semibold text-[var(--text)]">Shorts</h1>
        <span className="text-xs text-[var(--text-faint)]">Canva videos without voice-over</span>
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down max-w-sm">
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      {shorts.length === 0 && (
        <div className="card p-6 text-center text-[var(--text-muted)] text-sm">
          No shorts yet. They appear here when an approved video event has no voice-over.
        </div>
      )}

      {shorts.map((s) => {
        const color = NEWS_SHORT_STATUS_COLORS[s.status];
        return (
          <div key={s.id} className="card p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <Link
                  href={`/news/events/${s.event_id}`}
                  className="text-sm font-semibold text-[var(--text)] hover:text-[var(--color-purple)]"
                >
                  {s.headline || s.events?.event_title || `Event #${s.event_id}`}
                </Link>
                <p className="text-xs text-[var(--text-faint)] mt-0.5">
                  {summarize(s)} · {formatTimeAgo(s.updated_at)}
                </p>
              </div>
              <span className={`badge badge-${color}`}>{NEWS_SHORT_STATUS_LABELS[s.status]}</span>
            </div>

            {s.error && <p className="text-sm text-[var(--color-red)]">{s.error}</p>}

            {(s.export_url || s.media_url) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {s.media_url && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Merged video</p>
                    <video src={s.media_url} controls preload="metadata" className="w-full max-h-80 rounded-lg bg-black" />
                  </div>
                )}
                {s.export_url && (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Final from Canva</p>
                    <video src={s.export_url} controls preload="metadata" className="w-full max-h-80 rounded-lg bg-black" />
                  </div>
                )}
              </div>
            )}

            {s.status === "error" && (
              <button
                onClick={() => retry(s.id)}
                disabled={retrying === s.id}
                className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {retrying === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
