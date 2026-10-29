"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { MediaItem, PostFormat, TrendReview, TrendVideo } from "@/lib/news-types";
import {
  IMAGE_SECONDS,
  extractThumbnailCandidates,
  extractTrendNewsItems,
  extractTrendVideos,
  formatTimecode,
  isImageUrl,
  parseTimecode,
} from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { ThumbnailLightbox } from "@/components/thumbnail-lightbox";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Mic,
  Newspaper,
  Plus,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";

/** One row of the video being put together. Times are text while editing. */
interface DraftItem {
  id: number;
  type: "image" | "clip";
  url: string;
  start: string;
  end: string;
  note: string;
}

interface Draft {
  thumbs: string[];
  format: PostFormat | null;
  voiceover: boolean;
  media: DraftItem[];
  /** Video links added by hand, on top of the ones found in the articles. */
  extra: string[];
}

let nextItemId = 1;
const newItem = (type: DraftItem["type"], url: string): DraftItem => ({
  id: nextItemId++,
  type,
  url,
  start: "",
  end: "",
  note: "",
});

/** Builds the starting draft from whatever was already saved on the trend. */
function initialDraft(trend: TrendReview): Draft {
  const extracted = new Set(extractTrendVideos(trend.usableVideos).map((v) => v.url));
  const saved = trend.selected_media || [];
  const thumbs = trend.selected_thumbnails?.length
    ? trend.selected_thumbnails
    : trend.selected_thumbnail
      ? [trend.selected_thumbnail]
      : [];
  const media = saved.map((m) =>
    m.type === "image"
      ? newItem("image", m.url)
      : { ...newItem("clip", m.url), start: formatTimecode(m.start), end: formatTimecode(m.end), note: m.note || "" }
  );
  const extra = Array.from(new Set(saved.filter((m) => m.type === "clip" && !extracted.has(m.url)).map((m) => m.url)));
  return { thumbs, format: trend.post_format || null, voiceover: !!trend.voiceover, media, extra };
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

/** Total running time of the merged video, or null while a clip has no valid window yet. */
function totalSeconds(media: DraftItem[]): number | null {
  let total = 0;
  for (const m of media) {
    if (m.type === "image") {
      total += IMAGE_SECONDS;
      continue;
    }
    const start = parseTimecode(m.start);
    const end = parseTimecode(m.end);
    if (start === null || end === null || end <= start) return null;
    total += end - start;
  }
  return total;
}

export default function TrendReviewPage() {
  const [trends, setTrends] = useState<TrendReview[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"approved" | "rejected" | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [customThumbUrl, setCustomThumbUrl] = useState("");
  const [linkInput, setLinkInput] = useState("");
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
        <Link href="/" className="text-[var(--color-purple)] hover:opacity-80 text-sm mt-2 inline-block">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const draft = drafts[trend.id] || initialDraft(trend);
  const update = (fn: (d: Draft) => Draft) =>
    setDrafts((prev) => ({ ...prev, [trend.id]: fn(prev[trend.id] || initialDraft(trend)) }));
  const editItem = (id: number, patch: Partial<DraftItem>) =>
    update((d) => ({ ...d, media: d.media.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
  const removeItem = (id: number) => update((d) => ({ ...d, media: d.media.filter((m) => m.id !== id) }));
  const moveItem = (id: number, dir: -1 | 1) =>
    update((d) => {
      const i = d.media.findIndex((m) => m.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.media.length) return d;
      const media = [...d.media];
      [media[i], media[j]] = [media[j], media[i]];
      return { ...d, media };
    });
  const toggleThumb = (url: string) =>
    update((d) => ({ ...d, thumbs: d.thumbs.includes(url) ? d.thumbs.filter((u) => u !== url) : [...d.thumbs, url] }));
  const addImage = (url: string) =>
    update((d) => (d.media.some((m) => m.type === "image" && m.url === url) ? d : { ...d, media: [...d.media, newItem("image", url)] }));
  const addClip = (url: string) => update((d) => ({ ...d, media: [...d.media, newItem("clip", url)] }));

  const newsItems = extractTrendNewsItems(trend.news_items);
  const extracted = extractTrendVideos(trend.usableVideos);
  const videoList: TrendVideo[] = [
    ...extracted,
    ...draft.extra.filter((u) => !extracted.some((v) => v.url === u)).map((url) => ({ url, article_title: "Added by link" })),
  ];
  const imageCandidates = Array.from(
    new Set(
      [...extractThumbnailCandidates(trend.usableThumbnails), trend.picture, ...newsItems.map((n) => n.picture)].filter(
        (v): v is string => !!v
      )
    )
  );
  const thumbCandidates = Array.from(new Set([...draft.thumbs, ...imageCandidates]));
  const labelFor = (url: string) => videoList.find((v) => v.url === url)?.article_title || url;
  const total = totalSeconds(draft.media);

  /** Turns the rows into validated media items, or an error message. */
  const buildMedia = (): MediaItem[] | string => {
    const out: MediaItem[] = [];
    for (const m of draft.media) {
      if (m.type === "image") {
        out.push({ type: "image", url: m.url });
        continue;
      }
      const start = parseTimecode(m.start);
      const end = parseTimecode(m.end);
      if (start === null || end === null || end <= start) {
        return "Every clip needs a start time before its end time (like 0:12 and 0:25).";
      }
      out.push({ type: "clip", url: m.url, start, end, ...(m.note.trim() ? { note: m.note.trim() } : {}) });
    }
    return out;
  };

  const finish = async (status: "approved" | "rejected") => {
    const body: Record<string, unknown> = { status };
    if (status === "approved") {
      if (draft.thumbs.length === 0) return showFeedback("Select at least one thumbnail first.");
      if (!draft.format) return showFeedback("Choose Video or Static first.");
      body.post_format = draft.format;
      body.selected_thumbnails = draft.thumbs;
      if (draft.format === "video") {
        const media = buildMedia();
        if (typeof media === "string") return showFeedback(media, 5000);
        if (media.length === 0) return showFeedback("Add at least one clip or image to the video.");
        body.selected_media = media;
        body.voiceover = draft.voiceover;
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

  const addByLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    if (isImageUrl(url)) {
      addImage(url);
    } else {
      update((d) => ({
        ...d,
        extra: d.extra.includes(url) || extracted.some((v) => v.url === url) ? d.extra : [...d.extra, url],
        media: [...d.media, newItem("clip", url)],
      }));
    }
    setLinkInput("");
  };

  const position = Math.min(index, trends.length - 1);
  const lightboxImages = thumbCandidates;

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
          <h3 className="text-sm font-semibold text-[var(--text)]">Thumbnails</h3>
          <span className="text-xs text-[var(--text-faint)]">{draft.thumbs.length} selected</span>
        </div>
        <p className="text-xs text-[var(--text-faint)]">
          Click to select. The first one you pick is the main thumbnail; pick more if the post needs several images.
        </p>

        {thumbCandidates.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {thumbCandidates.map((url) => {
              const order = draft.thumbs.indexOf(url);
              return (
                <div key={url} className="relative group">
                  <button
                    onClick={() => toggleThumb(url)}
                    className={`w-full rounded-lg overflow-hidden border-2 transition-colors block ${
                      order >= 0 ? "border-[var(--color-purple)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="Thumbnail candidate" className="w-full h-24 object-cover" />
                  </button>
                  {order >= 0 && (
                    <span className="absolute top-1.5 left-1.5 min-w-5 h-5 px-1 rounded-full bg-[var(--color-purple)] text-white text-[11px] font-semibold flex items-center justify-center">
                      {order + 1}
                    </span>
                  )}
                  <button
                    onClick={() => setLightboxIndex(Math.max(0, lightboxImages.indexOf(url)))}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Expand thumbnail"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={customThumbUrl}
            onChange={(e) => setCustomThumbUrl(e.target.value)}
            placeholder="Or paste an image URL to add it..."
            className="input-field text-sm py-2 flex-1"
          />
          <button
            onClick={() => {
              const url = customThumbUrl.trim();
              if (url) {
                update((d) => (d.thumbs.includes(url) ? d : { ...d, thumbs: [...d.thumbs, url] }));
                setCustomThumbUrl("");
              }
            }}
            className="btn-secondary text-sm py-2 px-4 flex-shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      <div className="card p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text)]">Post format</h3>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { key: "static", label: "Static post", hint: "Image and headline", icon: ImageIcon },
              { key: "video", label: "Video", hint: "Short made of clips and images", icon: Video },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => update((d) => ({ ...d, format: opt.key }))}
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
        <>
          <div className="card p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Mic className="w-5 h-5 text-[var(--color-purple)]" />
              <h3 className="text-sm font-semibold text-[var(--text)]">Voice-over</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { value: false, label: "No voice-over", hint: "Canva short with music" },
                  { value: true, label: "With voice-over", hint: "Full video production pipeline" },
                ] as const
              ).map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => update((d) => ({ ...d, voiceover: opt.value }))}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    draft.voiceover === opt.value
                      ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)]"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--text)]">{opt.label}</span>
                  <span className="block text-xs text-[var(--text-faint)]">{opt.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-[var(--text)]">Your video, in order</h3>
              <span className="text-xs text-[var(--text-faint)]">
                {draft.media.length} items · about {total === null ? "—" : formatTimecode(total)}
                {" "}(images count {IMAGE_SECONDS}s each)
              </span>
            </div>

            {draft.media.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                Nothing added yet. Add images or clips below — you can use several clips from the same video.
              </p>
            )}

            {draft.media.map((m, i) => (
              <div key={m.id} className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3">
                <span className="text-xs font-mono text-[var(--text-faint)] pt-1 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0 space-y-2">
                  {m.type === "image" ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="Image in the video" className="h-14 w-20 object-cover rounded-lg" />
                      <span className="text-sm text-[var(--text)]">Image · {IMAGE_SECONDS}s</span>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-faint)] truncate">Clip · {labelFor(m.url)}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          value={m.start}
                          onChange={(e) => editItem(m.id, { start: e.target.value })}
                          placeholder="Start (0:12)"
                          className="input-field text-sm py-2"
                        />
                        <input
                          value={m.end}
                          onChange={(e) => editItem(m.id, { end: e.target.value })}
                          placeholder="End (0:25)"
                          className="input-field text-sm py-2"
                        />
                        <input
                          value={m.note}
                          onChange={(e) => editItem(m.id, { note: e.target.value })}
                          placeholder="Note — what happens in this part (optional)"
                          className="input-field text-sm py-2 col-span-2"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveItem(m.id, -1)}
                    disabled={i === 0}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => moveItem(m.id, 1)}
                    disabled={i === draft.media.length - 1}
                    className="btn-ghost p-1.5 disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeItem(m.id)} className="btn-ghost p-1.5 text-[var(--color-red)]" aria-label="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Add images</h3>
            {imageCandidates.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No images were found. Add one by link below.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {imageCandidates.map((url) => {
                  const added = draft.media.some((m) => m.type === "image" && m.url === url);
                  return (
                    <button
                      key={url}
                      onClick={() => (added ? update((d) => ({ ...d, media: d.media.filter((m) => !(m.type === "image" && m.url === url)) })) : addImage(url))}
                      className={`relative rounded-lg overflow-hidden border-2 transition-colors block ${
                        added ? "border-[var(--color-purple)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="Image candidate" className="w-full h-24 object-cover" />
                      {added && (
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-[var(--color-purple)] text-white p-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card p-4 sm:p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[var(--text)]">Add clips</h3>
            {videoList.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">No videos were found in these articles. Add one by link below.</p>
            )}
            {videoList.map((v) => {
              const count = draft.media.filter((m) => m.type === "clip" && m.url === v.url).length;
              return (
                <div key={v.url} className="rounded-xl border border-[var(--border)] p-3 space-y-3">
                  <VideoPlayer url={v.url} />
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-xs text-[var(--text-faint)] truncate max-w-full">
                      {v.article_title || v.url}
                      {v.source ? ` · ${v.source}` : ""}
                    </p>
                    <button
                      onClick={() => addClip(v.url)}
                      className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      Add a clip{count > 0 ? ` (${count} added)` : ""}
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex items-center gap-2">
              <input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Add a video or image link (YouTube, TikTok, a file)..."
                className="input-field text-sm py-2 flex-1"
              />
              <button onClick={addByLink} className="btn-secondary text-sm py-2 px-4 flex-shrink-0 inline-flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
        </>
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
          selectedUrl={draft.thumbs[0]}
          onClose={() => setLightboxIndex(null)}
          onSelect={(url) => {
            toggleThumb(url);
            setLightboxIndex(null);
          }}
        />
      )}
    </div>
  );
}
