"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PostFormat, SelectedVideo, TrendReview, TrendVideo } from "@/lib/news-types";
import {
  extractThumbnailCandidates,
  extractTrendNewsItems,
  extractTrendVideos,
  formatTimecode,
  parseTimecode,
} from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { ThumbnailLightbox } from "@/components/thumbnail-lightbox";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Video,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Maximize2,
  Plus,
  Newspaper,
} from "lucide-react";

interface VideoDraft {
  on: boolean;
  start: string;
  end: string;
  note: string;
}

interface Draft {
  thumb: string | null;
  format: PostFormat | null;
  videos: Record<string, VideoDraft>;
  extra: string[];
}

const EMPTY_VIDEO: VideoDraft = { on: false, start: "", end: "", note: "" };

/** Builds the starting draft from whatever was already saved on the trend. */
function initialDraft(trend: TrendReview): Draft {
  const videos: Record<string, VideoDraft> = {};
  const extracted = new Set(extractTrendVideos(trend.usableVideos).map((v) => v.url));
  const extra: string[] = [];
  for (const v of trend.selected_videos || []) {
    videos[v.url] = { on: true, start: formatTimecode(v.start), end: formatTimecode(v.end), note: v.note || "" };
    if (!extracted.has(v.url)) extra.push(v.url);
  }
  return { thumb: trend.selected_thumbnail || null, format: trend.post_format || null, videos, extra };
}

/** How to show a video link: an embed player, a plain file player, or just a link. */
function playerFor(url: string): { kind: "iframe" | "file" | "link"; src: string } {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const tt = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (tt) return { kind: "iframe", src: `https://www.tiktok.com/embed/v2/${tt[1]}` };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return { kind: "file", src: url };
  return { kind: "link", src: url };
}

function VideoPlayer({ url }: { url: string }) {
  const player = playerFor(url);
  if (player.kind === "iframe") {
    return (
      <iframe
        src={player.src}
        className="w-full aspect-video rounded-lg border border-[var(--border)]"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        loading="lazy"
        title="Video preview"
      />
    );
  }
  if (player.kind === "file") {
    return <video src={player.src} controls preload="metadata" className="w-full max-h-72 rounded-lg bg-black" />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-[var(--color-purple)] hover:opacity-80"
    >
      <ExternalLink className="w-4 h-4" />
      Can&apos;t preview here — open the video
    </a>
  );
}

export default function TrendReviewPage() {
  const [trends, setTrends] = useState<TrendReview[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customThumbUrl, setCustomThumbUrl] = useState("");
  const [manualVideo, setManualVideo] = useState("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch("/api/news/trends")
      .then((r) => r.json())
      .then((data: { trends?: TrendReview[] }) => setTrends(data.trends || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showFeedback = (msg: string, ms = 3500) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), ms);
  };

  const trend = trends[Math.min(index, trends.length - 1)];

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  if (!trend) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto text-center py-20">
        <Newspaper className="w-10 h-10 mx-auto text-[var(--text-faint)] mb-3" />
        <p className="text-[var(--text-muted)]">Nothing is waiting for review.</p>
        <Link href="/news/dashboard" className="text-[var(--color-purple)] hover:opacity-80 text-sm mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const draft = drafts[trend.id] || initialDraft(trend);
  const setDraft = (next: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [trend.id]: { ...(prev[trend.id] || initialDraft(trend)), ...next } }));
  const setVideo = (url: string, next: Partial<VideoDraft>) =>
    setDraft({ videos: { ...draft.videos, [url]: { ...(draft.videos[url] || EMPTY_VIDEO), ...next } } });

  const newsItems = extractTrendNewsItems(trend.news_items);
  const extracted = extractTrendVideos(trend.usableVideos);
  const videoList: TrendVideo[] = [
    ...extracted,
    ...draft.extra.filter((u) => !extracted.some((v) => v.url === u)).map((url) => ({ url, article_title: "Added manually" })),
  ];
  const thumbCandidates = Array.from(
    new Set(
      [...extractThumbnailCandidates(trend.usableThumbnails), trend.picture, ...newsItems.map((n) => n.picture)].filter(
        (v): v is string => !!v
      )
    )
  );
  const lightboxImages = Array.from(new Set([draft.thumb, ...thumbCandidates].filter((v): v is string => !!v)));

  /** Turns the video rows the reviewer ticked into validated {url, note, start, end}. */
  const buildSelectedVideos = (): SelectedVideo[] | string => {
    const out: SelectedVideo[] = [];
    for (const v of videoList) {
      const d = draft.videos[v.url];
      if (!d?.on) continue;
      const start = parseTimecode(d.start);
      const end = parseTimecode(d.end);
      if (start === null || end === null || end <= start) {
        return "Every selected video needs a start time before its end time (like 0:12 and 0:25).";
      }
      out.push({ url: v.url, start, end, ...(d.note.trim() ? { note: d.note.trim() } : {}) });
    }
    return out;
  };

  const finish = async (status: "approved" | "rejected") => {
    const body: Record<string, unknown> = { status };
    if (status === "approved") {
      if (!draft.thumb) return showFeedback("Select a thumbnail first.");
      if (!draft.format) return showFeedback("Choose Video or Static first.");
      body.post_format = draft.format;
      body.selected_thumbnail = draft.thumb;
      if (draft.format === "video") {
        const videos = buildSelectedVideos();
        if (typeof videos === "string") return showFeedback(videos, 5000);
        if (videos.length === 0) return showFeedback("Select at least one video for a video post.");
        body.selected_videos = videos;
      }
    }

    setBusy(status);
    try {
      const res = await fetch(`/api/news/trends/${trend.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setTrends((prev) => prev.filter((t) => t.id !== trend.id));
      setIndex((i) => Math.max(0, Math.min(i, trends.length - 2)));
      showFeedback(status === "approved" ? "Approved — it will move on to become an event." : "Rejected.");
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const addManualVideo = () => {
    const url = manualVideo.trim();
    if (!url) return;
    setDraft({
      extra: draft.extra.includes(url) ? draft.extra : [...draft.extra, url],
      videos: { ...draft.videos, [url]: { ...(draft.videos[url] || EMPTY_VIDEO), on: true } },
    });
    setManualVideo("");
  };

  const position = Math.min(index, trends.length - 1);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--text)]">Trend Review</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIndex(position - 1)}
            disabled={position === 0}
            className="btn-ghost p-2 disabled:opacity-30"
            aria-label="Previous trend"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs text-[var(--text-faint)]">
            {position + 1} of {trends.length}
          </span>
          <button
            onClick={() => setIndex(position + 1)}
            disabled={position >= trends.length - 1}
            className="btn-ghost p-2 disabled:opacity-30"
            aria-label="Next trend"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down max-w-sm">
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      <div className="card p-4 sm:p-6 space-y-4">
        <div>
          <p className="text-[10px] font-mono text-[var(--text-faint)] mb-1">
            Trend #{trend.id} · {formatTimeAgo(trend.created_at)}
            {trend.traffic ? ` · ${trend.traffic} searches` : ""}
          </p>
          <h2 className="text-xl font-semibold text-[var(--text)]">{trend.trending_keyword}</h2>
        </div>
        {newsItems.length > 0 && (
          <ul className="space-y-1.5">
            {newsItems.map((n, i) => (
              <li key={`${n.url}-${i}`} className="text-sm">
                {n.url ? (
                  <a href={n.url} target="_blank" rel="noreferrer" className="text-[var(--text)] hover:text-[var(--color-purple)]">
                    {n.title || n.url}
                  </a>
                ) : (
                  <span className="text-[var(--text)]">{n.title}</span>
                )}
                {n.source && <span className="text-[var(--text-faint)]"> · {n.source}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[var(--color-purple)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">Thumbnail</h3>
        </div>

        {draft.thumb && (
          <button
            onClick={() => setLightboxIndex(Math.max(0, lightboxImages.indexOf(draft.thumb!)))}
            className="relative group rounded-xl overflow-hidden border-2 border-[var(--color-purple)] w-fit block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.thumb} alt="Selected thumbnail" className="max-h-48" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <Maximize2 className="w-6 h-6 text-white" />
            </div>
          </button>
        )}

        {thumbCandidates.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {thumbCandidates.map((url) => (
              <div key={url} className="relative group">
                <button
                  onClick={() => setDraft({ thumb: url })}
                  className={`w-full rounded-lg overflow-hidden border-2 transition-colors block ${
                    draft.thumb === url ? "border-[var(--color-purple)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="Thumbnail candidate" className="w-full h-24 object-cover" />
                </button>
                <button
                  onClick={() => setLightboxIndex(Math.max(0, lightboxImages.indexOf(url)))}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Expand thumbnail"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
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
                setDraft({ thumb: customThumbUrl.trim() });
                setCustomThumbUrl("");
              }
            }}
            className="btn-secondary text-sm py-2 px-4 flex-shrink-0"
          >
            Set
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Post format</h3>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "static", label: "Static post", hint: "Image and headline", icon: ImageIcon },
              { key: "video", label: "Video", hint: "Short with clips", icon: Video },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setDraft({ format: opt.key })}
              className={`flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                draft.format === opt.key
                  ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)]"
                  : "border-[var(--border)] hover:border-[var(--border-strong)]"
              }`}
            >
              <opt.icon className="w-5 h-5 text-[var(--color-purple)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--text)]">{opt.label}</span>
                <span className="block text-xs text-[var(--text-faint)]">{opt.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {draft.format === "video" && (
        <div className="card p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-[var(--color-purple)]" />
            <h3 className="text-sm font-semibold text-[var(--text)]">Videos</h3>
          </div>
          <p className="text-xs text-[var(--text-faint)]">
            Tick each video you want to use and give the part to cut (start and end, like 0:12 and 0:25). The note is for you.
          </p>

          {videoList.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No videos were found in these articles. You can add a link below.</p>
          )}

          {videoList.map((v) => {
            const d = draft.videos[v.url] || EMPTY_VIDEO;
            return (
              <div key={v.url} className="rounded-xl border border-[var(--border)] p-3 space-y-3">
                <VideoPlayer url={v.url} />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs text-[var(--text-faint)] truncate max-w-full">
                    {v.article_title || v.url}
                    {v.source ? ` · ${v.source}` : ""}
                  </p>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text)] cursor-pointer">
                    <input type="checkbox" checked={d.on} onChange={(e) => setVideo(v.url, { on: e.target.checked })} />
                    Use this video
                  </label>
                </div>
                {d.on && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={d.start}
                      onChange={(e) => setVideo(v.url, { start: e.target.value })}
                      placeholder="Start (0:12)"
                      className="input-field text-sm py-2"
                    />
                    <input
                      value={d.end}
                      onChange={(e) => setVideo(v.url, { end: e.target.value })}
                      placeholder="End (0:25)"
                      className="input-field text-sm py-2"
                    />
                    <input
                      value={d.note}
                      onChange={(e) => setVideo(v.url, { note: e.target.value })}
                      placeholder="Note — what happens in this part (optional)"
                      className="input-field text-sm py-2 col-span-2"
                    />
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex items-center gap-2">
            <input
              value={manualVideo}
              onChange={(e) => setManualVideo(e.target.value)}
              placeholder="Add a video link (YouTube, TikTok or a direct file)..."
              className="input-field text-sm py-2 flex-1"
            />
            <button onClick={addManualVideo} className="btn-secondary text-sm py-2 px-4 flex-shrink-0 inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 [&>*]:flex-1 sm:[&>*]:flex-none [&>*]:justify-center">
        <button
          onClick={() => finish("rejected")}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] text-sm font-semibold text-[var(--color-red)] hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {busy === "rejected" ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Reject
        </button>
        <button
          onClick={() => finish("approved")}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {busy === "approved" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Approve
        </button>
      </div>

      {lightboxIndex !== null && (
        <ThumbnailLightbox
          images={lightboxImages}
          startIndex={lightboxIndex}
          selectedUrl={draft.thumb || undefined}
          onClose={() => setLightboxIndex(null)}
          onSelect={(url) => {
            setDraft({ thumb: url });
            setLightboxIndex(null);
          }}
        />
      )}
    </div>
  );
}
