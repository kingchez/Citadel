"use client";

import { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import type { NewsEvent } from "@/lib/news-types";
import { extractThumbnailCandidates, EVENT_STATUS_LABELS } from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  TrendingUp,
  CheckCircle2,
  PauseCircle,
  Video,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface EventDetailProps {
  params: Promise<{ id: string }>;
}

const CHANNELS = [
  "Pure Pulse", "Capital Code", "Insight Within", "Reel Talk", "The Daily Signal", "Curious Atlas",
  "Taste the World", "Wild & Whiskered", "Game Point", "Full Throttle", "Viral Shop", "Flow Nation",
];

export default function EventDetailPage({ params }: EventDetailProps) {
  const { id } = use(params);
  const [event, setEvent] = useState<NewsEvent | null>(null);
  const [allEvents, setAllEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customThumbUrl, setCustomThumbUrl] = useState("");
  const [showConvert, setShowConvert] = useState(false);
  const [convertChannel, setConvertChannel] = useState("The Daily Signal");
  const [convertType, setConvertType] = useState<"vertical-shorts" | "horizontal-long">("vertical-shorts");
  const [converting, setConverting] = useState(false);

  const load = useCallback(() => {
    fetch("/api/news/events")
      .then((r) => r.json())
      .then((data: { events?: NewsEvent[] }) => {
        const events = data.events || [];
        setAllEvents(events);
        const found = events.find((e) => String(e.id) === id);
        setEvent(found || null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const showFeedback = (msg: string, ms = 3000) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), ms);
  };

  const patch = async (fields: Partial<NewsEvent>) => {
    if (!event) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/news/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setEvent(data.event);
      return true;
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleConvert = async () => {
    if (!event) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/news/events/${event.id}/convert-to-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: convertChannel, video_type: convertType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create video.");
      showFeedback("Video created with priority — it'll be picked up ahead of the current queue.", 4500);
      setShowConvert(false);
      load();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not create video.");
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return <div className="p-6 max-w-4xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  if (!event) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <p className="text-[var(--text-muted)]">Event not found.</p>
        <Link href="/news/events" className="text-[var(--color-purple)] hover:opacity-80 text-sm mt-2 inline-block">
          Back to Events
        </Link>
      </div>
    );
  }

  const currentIndex = allEvents.findIndex((e) => e.id === event.id);
  const prevEvent = currentIndex > 0 ? allEvents[currentIndex - 1] : null;
  const nextEvent = currentIndex >= 0 && currentIndex < allEvents.length - 1 ? allEvents[currentIndex + 1] : null;

  const thumbCandidates = Array.from(
    new Set([...extractThumbnailCandidates(event.usablethumbnails), event.alt_thumbnail].filter((v): v is string => !!v))
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/news/events" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Events
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={prevEvent ? `/news/events/${prevEvent.id}` : "#"}
            className={`btn-ghost p-2 ${!prevEvent ? "opacity-30 pointer-events-none" : ""}`}
            aria-label="Previous event"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <span className="text-xs text-[var(--text-faint)]">
            {currentIndex + 1} of {allEvents.length}
          </span>
          <Link
            href={nextEvent ? `/news/events/${nextEvent.id}` : "#"}
            className={`btn-ghost p-2 ${!nextEvent ? "opacity-30 pointer-events-none" : ""}`}
            aria-label="Next event"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="badge badge-cyan">{EVENT_STATUS_LABELS[event.status]}</span>
              {event.golden_window_hours != null && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-amber)] font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {event.golden_window_hours}h window
                </span>
              )}
              {event.global_relevance_score != null && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Relevance {event.global_relevance_score.toFixed(1)}
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono text-[var(--text-faint)]">Event #{event.id} · {formatTimeAgo(event.created_at)}</p>
          </div>

          {event.video_id ? (
            <Link
              href={`/pipeline/videos/${event.video_id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-green-soft)] text-[var(--color-green)] border border-[var(--color-green)]/30 hover:bg-[var(--color-green)] hover:text-white transition-all text-sm font-semibold"
            >
              <Video className="w-4 h-4" />
              View Video
            </Link>
          ) : (
            <button
              onClick={() => setShowConvert(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-purple)] text-white hover:opacity-90 transition-opacity text-sm font-semibold"
            >
              <Video className="w-4 h-4" />
              Turn Into Video
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down max-w-sm">
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      <div className="card p-5 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Social Headline</label>
        <input
          defaultValue={event.social_headline || ""}
          onBlur={(e) => e.target.value !== (event.social_headline || "") && patch({ social_headline: e.target.value })}
          className="input-field"
          placeholder="Headline for social posts..."
        />
      </div>

      <div className="card p-5 space-y-3">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Snapshot Summary</label>
        <textarea
          defaultValue={event.snapshot_summary || ""}
          onBlur={(e) => e.target.value !== (event.snapshot_summary || "") && patch({ snapshot_summary: e.target.value })}
          rows={3}
          className="input-field resize-none"
          placeholder="Quick summary of the event..."
        />
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Article</h3>
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Title</label>
          <input
            defaultValue={event.article?.title || ""}
            onBlur={(e) =>
              e.target.value !== (event.article?.title || "") &&
              patch({ article: { ...event.article, title: e.target.value } })
            }
            className="input-field"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Dek</label>
          <input
            defaultValue={event.article?.dek || ""}
            onBlur={(e) =>
              e.target.value !== (event.article?.dek || "") && patch({ article: { ...event.article, dek: e.target.value } })
            }
            className="input-field"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">Body</label>
          <textarea
            defaultValue={event.article?.body || ""}
            onBlur={(e) =>
              e.target.value !== (event.article?.body || "") &&
              patch({ article: { ...event.article, body: e.target.value } })
            }
            rows={8}
            className="input-field resize-none font-mono text-sm"
          />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[var(--color-purple)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Thumbnail</h3>
        </div>

        {event.thumbnail && (
          <div className="rounded-xl overflow-hidden border-2 border-[var(--color-purple)] w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={event.thumbnail} alt="Selected thumbnail" className="max-h-48" />
          </div>
        )}

        {thumbCandidates.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {thumbCandidates.map((url) => (
              <button
                key={url}
                onClick={() => patch({ thumbnail: url })}
                className={`rounded-lg overflow-hidden border-2 transition-colors ${
                  event.thumbnail === url ? "border-[var(--color-purple)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Thumbnail candidate" className="w-full h-24 object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={customThumbUrl}
            onChange={(e) => setCustomThumbUrl(e.target.value)}
            placeholder="Or paste a thumbnail URL directly..."
            className="input-field text-sm py-2 flex-1"
          />
          <button
            onClick={() => {
              if (customThumbUrl.trim()) {
                patch({ thumbnail: customThumbUrl.trim() });
                setCustomThumbUrl("");
              }
            }}
            className="btn-secondary text-sm py-2 px-4 flex-shrink-0"
          >
            Set
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        {event.status !== "paused" && (
          <button
            onClick={() => patch({ status: "paused" })}
            disabled={saving}
            className="btn-secondary flex items-center gap-2 py-2.5 px-5 disabled:opacity-50"
          >
            <PauseCircle className="w-4 h-4" />
            Pause
          </button>
        )}
        {event.status !== "reviewed" && (
          <button
            onClick={() => patch({ status: "reviewed" })}
            disabled={saving}
            className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--color-green)] text-white hover:opacity-90 transition-opacity text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Mark Reviewed
          </button>
        )}
      </div>

      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={() => setShowConvert(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-[var(--text)] text-lg">Turn Into Video</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Creates a priority video in the Video Pipeline from this event. It jumps ahead of whatever&apos;s currently
              queued (not yet dispatched) — news is time-sensitive.
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Channel</label>
              <select
                value={convertChannel}
                onChange={(e) => setConvertChannel(e.target.value)}
                className="input-field"
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Format</label>
              <div className="flex gap-2">
                {(["vertical-shorts", "horizontal-long"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setConvertType(t)}
                    className={`tab flex-1 ${convertType === t ? "tab-active" : ""}`}
                  >
                    {t === "vertical-shorts" ? "Vertical" : "Horizontal"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowConvert(false)} className="btn-secondary py-2 px-4 text-sm">
                Cancel
              </button>
              <button
                onClick={handleConvert}
                disabled={converting}
                className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
              >
                {converting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Priority Video
              </button>
            </div>
          </div>
        </div>
      )}

      {(event.seo || event.editorial_metadata) && (
        <details className="card group">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-[var(--surface-raised)] transition-colors rounded-xl">
            <span className="font-semibold text-[var(--text)]">Raw Metadata</span>
            <ExternalLink className="w-4 h-4 text-[var(--text-faint)]" />
          </summary>
          <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]">
            <pre className="text-xs text-[var(--text-muted)] font-mono whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify({ seo: event.seo, editorial_metadata: event.editorial_metadata }, null, 2)}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
