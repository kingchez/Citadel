"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, SkipForward, Trash2, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Choice, Field, PriorityField } from "@/components/add-video-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatSeconds, parseTimeToSeconds } from "@/lib/repurpose-utils";
import { MAX_SOURCES } from "@/lib/repurpose-sources";
import { REPURPOSE_STATUS_LABELS, SUPPORTED_CHANNELS, type RepurposeStatus, type SubtitleChoice } from "@/lib/repurpose-types";
import {
  CHANNEL_STATUS_LABELS,
  type ChannelPlatform,
  type ScrapedVideo,
  type SourceChannel,
} from "@/lib/repurpose-channels";

type IntroMode = "keep_original" | "replace";
type ViewMode = "vertical-shorts" | "horizontal-long";
type AddKind = "single" | "start" | "merge";
interface MergeTarget {
  id: string;
  title: string;
  status: RepurposeStatus;
  video_type: ViewMode | null;
  source_count: number;
}
type Flash = { tone: "ok" | "warn" | "error"; message: string; lines?: string[] } | null;

const STATUS_TONE: Record<SourceChannel["status"], string> = {
  pending: "text-[var(--color-purple)]",
  processing: "text-[var(--color-cyan)]",
  active: "text-[var(--color-green)]",
  paused: "text-[var(--color-amber)]",
  error: "text-[var(--color-red)]",
};

/** The iframe src for the player. TikTok uses its own player page; YouTube the standard embed. */
function embedSrc(platform: ChannelPlatform, videoId: string): string {
  if (platform === "tiktok") return `https://www.tiktok.com/player/v1/${videoId}`;
  return `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1`;
}

async function fetchChannelList(): Promise<{ channels?: SourceChannel[]; error?: string }> {
  try {
    const res = await fetch("/api/repurpose-channels", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Couldn't load channels." };
    return { channels: data.channels || [] };
  } catch {
    return { error: "Couldn't load channels." };
  }
}

async function fetchVideoBatch(): Promise<{ videos?: ScrapedVideo[]; total?: number; error?: string }> {
  try {
    const res = await fetch("/api/repurpose-videos?limit=20", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) return { error: data.error || "Couldn't load videos." };
    return { videos: data.videos || [], total: data.total ?? 0 };
  } catch {
    return { error: "Couldn't load videos." };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Channels panel: add a channel, see its scrape status, remove it.
// ---------------------------------------------------------------------------------------------------------------

function ChannelsPanel({ onChanged }: { onChanged: () => void }) {
  const [channels, setChannels] = useState<SourceChannel[] | null>(null);
  const [platform, setPlatform] = useState<ChannelPlatform>("youtube");
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<SourceChannel | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const apply = useCallback((r: { channels?: SourceChannel[]; error?: string }) => {
    if (r.error) setError(r.error);
    setChannels((prev) => r.channels ?? prev ?? []);
  }, []);
  const load = useCallback(() => fetchChannelList().then(apply), [apply]);

  useEffect(() => {
    // While a channel is waiting for n8n to scrape it, keep the list fresh.
    fetchChannelList().then(apply);
    const t = setInterval(() => fetchChannelList().then(apply), 15000);
    return () => clearInterval(t);
  }, [apply]);

  const add = async () => {
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/repurpose-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, input }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't add the channel.");
        return;
      }
      setInput("");
      await load();
    } catch {
      setError("Network error - nothing was saved.");
    } finally {
      setAdding(false);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/repurpose-channels/${removing.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't remove the channel.");
      } else {
        await load();
        onChanged();
      }
    } catch {
      setError("Network error - nothing was removed.");
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-6 space-y-4">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="input-field text-sm sm:!w-36"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as ChannelPlatform)}
            aria-label="Platform"
          >
            <option value="youtube">YouTube</option>
            <option value="tiktok" disabled>
              TikTok (soon)
            </option>
          </select>
          <input
            className="input-field text-sm flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && input.trim() && !adding && add()}
            placeholder="@channelhandle or https://youtube.com/@channelhandle"
          />
          <button type="button" className="btn-primary flex items-center justify-center gap-2 text-sm !py-2.5" disabled={!input.trim() || adding} onClick={add}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add channel
          </button>
        </div>
        {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
      </div>

      {channels === null ? (
        <p className="text-sm text-[var(--text-faint)] flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading channels…
        </p>
      ) : channels.length === 0 ? (
        <p className="text-sm text-[var(--text-faint)]">No channels yet. Add one above - its latest videos are scraped automatically and show up here for review.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {channels.map((c) => (
            <li key={c.id} className="py-3 flex items-center gap-3">
              {c.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.avatar_url} alt="" className="w-9 h-9 rounded-full flex-shrink-0 bg-[var(--surface-raised)]" />
              ) : (
                <div className="w-9 h-9 rounded-full flex-shrink-0 bg-[var(--surface-raised)] flex items-center justify-center">
                  <Users className="w-4 h-4 text-[var(--text-faint)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text)] truncate">{c.channel_name || c.channel_username || c.channel_id}</p>
                <p className="text-xs text-[var(--text-faint)] truncate">
                  <span className={STATUS_TONE[c.status]}>{CHANNEL_STATUS_LABELS[c.status]}</span>
                  {" · "}
                  {c.platform === "youtube" ? "YouTube" : "TikTok"}
                  {" · "}
                  {c.video_count} to review
                </p>
                {c.status === "error" && c.error_details && <p className="text-xs text-[var(--color-red)] break-words">{c.error_details}</p>}
              </div>
              <button type="button" className="btn-ghost flex-shrink-0" onClick={() => setRemoving(c)} aria-label={`Remove ${c.channel_name || c.channel_username || "channel"}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!removing}
        title="Remove this channel?"
        message={`${removing?.video_count ?? 0} video(s) from it still waiting for review will be deleted too. Videos already added to the repurpose queue are not touched.`}
        confirmLabel="Remove channel"
        danger
        busy={removeBusy}
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// One video under review: player (left on desktop, on top on mobile) + the same fields as the link form (right).
// Mounted with key={video.id}, so every field starts fresh for each video.
// ---------------------------------------------------------------------------------------------------------------

function ReviewCard({
  video,
  poolTotal,
  onQueued,
  onRemoved,
  onSkip,
  canSkip,
  lastTargetId,
  onMergedInto,
}: {
  video: ScrapedVideo;
  poolTotal: number;
  onQueued: (video: ScrapedVideo, flash: Flash) => void;
  onRemoved: (video: ScrapedVideo) => void;
  onSkip: () => void;
  canSkip: boolean;
  lastTargetId: string;
  onMergedInto: (targetId: string) => void;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(video.is_shorts ? "vertical-shorts" : "horizontal-long");
  const [title, setTitle] = useState(video.title || "");
  const [url, setUrl] = useState(video.video_url);
  const [introMode, setIntroMode] = useState<IntroMode>("keep_original");
  const [introUrl, setIntroUrl] = useState("");
  const [introStart, setIntroStart] = useState("");
  const [priority, setPriority] = useState(false);
  const [productsRaw, setProductsRaw] = useState("");
  const [subtitles, setSubtitles] = useState<SubtitleChoice>("later");
  const [instructions, setInstructions] = useState<string[]>([""]);

  const [kind, setKind] = useState<AddKind>("single");
  const [extraUrls, setExtraUrls] = useState<string[]>([]);
  const [targets, setTargets] = useState<MergeTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(false);
  const [targetId, setTargetId] = useState(lastTargetId);
  const [pastedId, setPastedId] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [finishNote, setFinishNote] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  const startSeconds = useMemo(() => parseTimeToSeconds(introStart), [introStart]);
  const isMerge = kind === "merge";
  const mergeTarget = isMerge ? pastedId.trim() || targetId : "";
  const canSubmit = isMerge
    ? !!url.trim() && !!mergeTarget
    : !!title.trim() && !!url.trim() && (introMode === "keep_original" || (!!introUrl.trim() && startSeconds !== null));
  const pickedTarget = targets.find((t) => t.id === targetId);
  const isShort = viewMode === "vertical-shorts";

  const openMerge = async () => {
    setKind("merge");
    setTargetsLoading(true);
    try {
      const res = await fetch("/api/repurpose-videos/merge-targets", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load items.");
      const list: MergeTarget[] = data.targets || [];
      setTargets(list);
      setTargetId((prev) => (list.some((t) => t.id === prev) ? prev : ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load items.");
    } finally {
      setTargetsLoading(false);
    }
  };

  // Merge complete: release the held item so the pipeline starts on it.
  const finishMerge = async () => {
    setFinishing(true);
    setError(null);
    setFinishNote(null);
    try {
      const res = await fetch(`/api/repurpose/${targetId}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hold: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't finish the merge.");
        return;
      }
      setFinishNote(`“${pickedTarget?.title ?? "The item"}” is released and will start processing.`);
      setTargets((prev) => prev.filter((t) => t.id !== targetId));
      setTargetId("");
    } catch {
      setError("Network error - nothing changed.");
    } finally {
      setFinishing(false);
    }
  };

  const submitMerge = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/repurpose-videos/${video.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: mergeTarget, url: url.trim(), priority, instructions: instructions.map((t) => t.trim()).filter(Boolean) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      const warnings = (data.warnings as string[] | undefined) || [];
      if (!pastedId.trim()) onMergedInto(targetId);
      const added = (data.notes_added as number | undefined) || 0;
      const into = `“${data.item?.title || "the item"}” (${data.item?.total_sources ?? "?"} videos)${added > 0 ? `, ${added} note${added === 1 ? "" : "s"} added` : ""}`;
      onQueued(video, warnings.length > 0 ? { tone: "warn", message: `Merged into ${into} - ${warnings.join(" ")}` } : { tone: "ok", message: `Merged into ${into}.` });
    } catch {
      setError("Network error - nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async () => {
    if (isMerge) return submitMerge();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pipeline/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "repurpose",
          title,
          channel: SUPPORTED_CHANNELS[0],
          video_type: viewMode,
          subtitles,
          instructions: instructions.map((t) => t.trim()).filter(Boolean),
          products_raw: productsRaw,
          priority,
          ...(kind === "start" ? { hold_for_merge: true } : {}),
          scraped_video_id: video.id,
          source_video_urls: [url.trim(), ...(kind === "start" ? extraUrls.map((u) => u.trim()).filter(Boolean) : [])],
          intro_mode: introMode,
          ...(introMode === "replace" ? { new_intro_url: introUrl, new_intro_start: introStart } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      const lines: string[] = [];
      const messages: string[] = [];
      const p = data.products as { error?: string; failed?: string[] } | null;
      if (p?.error) messages.push(`The products couldn't be added: ${p.error} You can add them from the video page.`);
      else if (p?.failed && p.failed.length > 0) {
        messages.push("Some product links/ASINs couldn't be read (the rest were added):");
        lines.push(...p.failed);
      }
      for (const w of (data.warnings as string[] | undefined) || []) messages.push(w);
      onQueued(
        video,
        messages.length > 0
          ? { tone: "warn", message: `“${title.trim()}” — ${messages.join(" ")}`, lines }
          : { tone: "ok", message: kind === "start" ? `Added “${title.trim()}” (${1 + extraUrls.filter((u) => u.trim()).length} video${extraUrls.some((u) => u.trim()) ? "s" : ""}) and holding it for a merge. It now shows in the “Merge into” list.` : `Added “${title.trim()}” to the repurpose queue.` }
      );
    } catch {
      setError("Network error - nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const doRemove = async () => {
    setRemoveBusy(true);
    try {
      const res = await fetch(`/api/repurpose-videos/${video.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't remove the video.");
        setConfirmRemove(false);
        return;
      }
      onRemoved(video);
    } catch {
      setError("Network error - nothing was removed.");
      setConfirmRemove(false);
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
      {/* Player */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 space-y-3 lg:sticky lg:top-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Choice value="vertical-shorts" current={viewMode} onSelect={setViewMode}>
              Short
            </Choice>
            <Choice value="horizontal-long" current={viewMode} onSelect={setViewMode}>
              Long
            </Choice>
          </div>
          <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">
            {poolTotal} in pool
          </span>
        </div>

        <div className={cn("mx-auto w-full overflow-hidden rounded-xl bg-black", isShort ? "max-w-[18rem] aspect-[9/16]" : "aspect-video")}>
          <iframe
            key={`${video.id}-${viewMode}`}
            src={embedSrc(video.platform, video.video_id)}
            title={video.title || "Video preview"}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>

        <div className="flex items-center justify-between gap-2 text-xs text-[var(--text-faint)]">
          <span className="truncate">
            {video.channel_name || "Unknown channel"}
            {video.duration_seconds ? ` · ${formatSeconds(video.duration_seconds)}` : ""}
            {video.is_shorts !== isShort ? " · label overridden" : ""}
          </span>
          <a href={video.video_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[var(--text)] whitespace-nowrap">
            Open <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Form */}
      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-6 space-y-6 min-w-0">
        <Field label="Add as">
          <div className="flex gap-2">
            <Choice value="single" current={kind} onSelect={() => setKind("single")}>
              Single video
            </Choice>
            <Choice value="start" current={kind} onSelect={() => setKind("start")}>
              Start a merge
            </Choice>
            <Choice value="merge" current={kind} onSelect={openMerge}>
              Merge into another
            </Choice>
          </div>
          {kind === "start" && <p className="text-xs text-[var(--text-faint)]">Added on hold: the pipeline leaves it alone until you press “Finish merge”.</p>}
        </Field>

        {!isMerge && (
          <>
            <Field label="Channel">
              <p className="text-sm text-[var(--text)]">{SUPPORTED_CHANNELS[0]}</p>
            </Field>

            <Field label="Title">
              <input className="input-field text-sm" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working title for this video" maxLength={200} />
            </Field>
          </>
        )}

        <Field label="Original video link">
          <input className="input-field text-sm font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          {url.trim() && (
            <p className="text-xs text-[var(--color-purple)]">
              {video.platform === "tiktok" ? "TikTok" : "YouTube"} link - it will be downloaded automatically before splitting.
            </p>
          )}
        </Field>

        <Field label="Video description">
          <div className="input-field text-sm whitespace-pre-wrap break-words max-h-48 overflow-y-auto text-[var(--text-muted)]">
            {video.description?.trim() || "No description."}
          </div>
        </Field>

        {kind === "start" && (
          <Field label="More videos for this merge" hint={`Optional. The video above is Video 1. Paste any other video links to merge with it (up to ${MAX_SOURCES} in total).`}>
            <div className="space-y-2">
              {extraUrls.map((u, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    className="input-field text-sm font-mono flex-1"
                    value={u}
                    onChange={(e) => setExtraUrls((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                    placeholder={`Video ${i + 2} link`}
                  />
                  <button type="button" onClick={() => setExtraUrls((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--text-faint)] hover:text-[var(--color-red)] px-2" aria-label={`Remove video ${i + 2} link`}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {extraUrls.length + 1 < MAX_SOURCES && (
                <button type="button" onClick={() => setExtraUrls((prev) => [...prev, ""])} className="text-xs font-medium text-[var(--color-purple)] hover:underline">
                  + Add another video link
                </button>
              )}
            </div>
          </Field>
        )}

        {isMerge && (
          <div className="space-y-4 pl-4 border-l border-[var(--border)]">
            <Field label="Merge into" hint="Only items on hold for merging. Start one with “Start a merge”, or press “Hold for merge” on the Repurpose page.">
              <select className="input-field text-sm" value={targetId} onChange={(e) => setTargetId(e.target.value)} disabled={targetsLoading}>
                <option value="">{targetsLoading ? "Loading…" : targets.length === 0 ? "No items on hold" : "Choose an item…"}</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {REPURPOSE_STATUS_LABELS[t.status] ?? t.status} · {t.source_count} video{t.source_count === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
              {targetId && !pastedId.trim() && (
                <button type="button" className="text-xs font-medium text-[var(--color-purple)] hover:underline disabled:opacity-50" disabled={finishing || submitting} onClick={finishMerge}>
                  {finishing ? "Releasing…" : "Finish merge (start processing this item)"}
                </button>
              )}
              {finishNote && <p className="text-xs text-[var(--color-green)]">{finishNote}</p>}
              {pickedTarget?.video_type && pickedTarget.video_type !== viewMode && !pastedId.trim() && (
                <p className="text-xs text-[var(--color-amber)]">
                  That item is a {pickedTarget.video_type === "vertical-shorts" ? "Short" : "Long"} video and this one is set to {isShort ? "Short" : "Long"}.
                </p>
              )}
            </Field>
            <Field label="Or paste an ID" hint="The repurpose item's ID or its video's ID. Overrides the list above.">
              <input className="input-field text-sm font-mono" value={pastedId} onChange={(e) => setPastedId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </Field>
          </div>
        )}

        {!isMerge && (
          <>
        <Field label="Intro">
          <div className="flex gap-2 flex-wrap">
            <Choice value="keep_original" current={introMode} onSelect={setIntroMode}>
              Keep original intro
            </Choice>
            <Choice value="replace" current={introMode} onSelect={setIntroMode}>
              Use another intro
            </Choice>
          </div>
        </Field>

        {introMode === "replace" && (
          <div className="space-y-4 pl-4 border-l border-[var(--border)]">
            <Field label="New intro video link">
              <input className="input-field text-sm font-mono" value={introUrl} onChange={(e) => setIntroUrl(e.target.value)} placeholder="https://…/intro.mp4  or  https://drive.google.com/file/d/…" />
            </Field>
            <Field
              label="Start cutting from"
              hint={startSeconds !== null ? `Starts at ${formatSeconds(startSeconds)} in the new intro. The planning agent trims as much as the original intro is long.` : "Format like 0:13 or 1:05."}
            >
              <input className="input-field text-sm font-mono w-40" value={introStart} onChange={(e) => setIntroStart(e.target.value)} placeholder="0:00" />
              {introStart.trim() && startSeconds === null && <p className="text-xs text-[var(--color-red)]">Not a valid time.</p>}
            </Field>
          </div>
        )}

          </>
        )}

        <PriorityField priority={priority} onChange={setPriority} />

        {!isMerge && (
          <>
        <Field label="Affiliate products" hint="Optional. Paste Amazon URLs or ASINs, one per line or comma separated.">
          <textarea className="input-field text-sm resize-none font-mono" rows={4} value={productsRaw} onChange={(e) => setProductsRaw(e.target.value)} placeholder="https://www.amazon.com/dp/B0XXXXXXXX" />
        </Field>

          </>
        )}

        <Field label="Notes for the agent" hint={isMerge ? "Optional. Added to the notes the item you merge into already has." : "Optional. Anything the agent must know or do for this video - one instruction per box."}>
          <div className="space-y-2">
            {instructions.map((t, i) => (
              <div key={i} className="flex gap-2 items-start">
                <textarea
                  className="input-field text-sm resize-none flex-1"
                  rows={2}
                  value={t}
                  onChange={(e) => setInstructions((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))}
                  placeholder={`Instruction ${i + 1}`}
                  maxLength={2000}
                />
                {instructions.length > 1 && (
                  <button type="button" onClick={() => setInstructions((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--text-faint)] hover:text-[var(--color-red)] px-2 pt-2" aria-label={`Remove instruction ${i + 1}`}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setInstructions((prev) => [...prev, ""])} className="text-xs font-medium text-[var(--color-purple)] hover:underline">
              + Add another instruction
            </button>
          </div>
        </Field>

        {!isMerge && (
          <>
        <Field label="Subtitles" hint="“Decide later” leaves it for the planning agent to ask.">
          <div className="flex gap-2 flex-wrap">
            <Choice value="yes" current={subtitles} onSelect={setSubtitles}>
              Yes
            </Choice>
            <Choice value="no" current={subtitles} onSelect={setSubtitles}>
              No
            </Choice>
            <Choice value="later" current={subtitles} onSelect={setSubtitles}>
              Decide later
            </Choice>
          </div>
        </Field>

          </>
        )}

        {error && <div className="rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/30 px-4 py-3 text-sm text-[var(--color-red)]">{error}</div>}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex items-center justify-center gap-2 flex-1 sm:flex-none" disabled={submitting} onClick={() => setConfirmRemove(true)}>
              <Trash2 className="w-4 h-4" /> Remove
            </button>
            <button type="button" className="btn-secondary text-sm flex items-center justify-center gap-2 flex-1 sm:flex-none" disabled={submitting || !canSkip} onClick={onSkip} title="Keep it in the pool and show another video">
              <SkipForward className="w-4 h-4" /> Skip
            </button>
          </div>
          <button type="button" className="btn-primary flex items-center justify-center gap-2" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isMerge ? "Merge into item" : kind === "start" ? "Add and hold for merge" : "Add to repurpose queue"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this video?"
        message="It will be deleted from the review pool and won't be shown again."
        confirmLabel="Remove video"
        danger
        busy={removeBusy}
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// The section: channels panel + the random review queue.
// ---------------------------------------------------------------------------------------------------------------

export function AddByChannel() {
  const [videos, setVideos] = useState<ScrapedVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showChannels, setShowChannels] = useState(false);
  const [flash, setFlash] = useState<Flash>(null);
  const [lastTargetId, setLastTargetId] = useState("");

  const apply = useCallback((r: { videos?: ScrapedVideo[]; total?: number; error?: string }) => {
    setLoadError(r.error ?? null);
    if (r.videos) {
      setVideos(r.videos);
      setTotal(r.total ?? 0);
    }
    setLoading(false);
  }, []);
  const load = useCallback(() => fetchVideoBatch().then(apply), [apply]);

  useEffect(() => {
    fetchVideoBatch().then(apply);
  }, [apply]);

  // After a video leaves the pool (added or removed): drop it locally, and fetch a fresh random batch when the
  // local one runs out but the pool still has more.
  const afterLeave = (video: ScrapedVideo) => {
    const rest = videos.filter((v) => v.id !== video.id);
    const newTotal = Math.max(0, total - 1);
    setVideos(rest);
    setTotal(newTotal);
    if (rest.length === 0 && newTotal > 0) load();
  };

  const current = videos[0];

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-faint)]">
          {loading ? "Loading…" : total > 0 ? `${total} video${total === 1 ? "" : "s"} waiting for review - shown in random order, mixed across channels.` : "No videos waiting for review."}
        </p>
        <button type="button" className={cn("btn-secondary text-sm flex items-center gap-2 whitespace-nowrap", showChannels && "!border-[var(--color-purple)]")} onClick={() => setShowChannels((v) => !v)} aria-expanded={showChannels}>
          <Users className="w-4 h-4" /> Channels
        </button>
      </div>

      {showChannels && <ChannelsPanel onChanged={load} />}

      {flash && (
        <div
          className={cn(
            "rounded-xl border px-4 py-3 text-sm space-y-1 flex items-start justify-between gap-3",
            flash.tone === "ok" && "bg-[var(--color-green-soft)] border-[var(--color-green)]/30 text-[var(--color-green)]",
            flash.tone === "warn" && "bg-[var(--color-amber-soft)] border-[var(--color-amber)]/30 text-[var(--color-amber)]",
            flash.tone === "error" && "bg-[var(--color-red-soft)] border-[var(--color-red)]/30 text-[var(--color-red)]"
          )}
        >
          <div className="min-w-0">
            <p className="break-words">{flash.message}</p>
            {flash.lines && flash.lines.length > 0 && (
              <ul className="font-mono text-xs list-disc pl-5">
                {flash.lines.map((l) => (
                  <li key={l} className="break-all">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {loadError && <div className="rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/30 px-4 py-3 text-sm text-[var(--color-red)]">{loadError}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--text-faint)]" />
        </div>
      ) : current ? (
        <ReviewCard
          key={current.id}
          video={current}
          poolTotal={total}
          canSkip={videos.length > 1 || total > videos.length}
          lastTargetId={lastTargetId}
          onMergedInto={setLastTargetId}
          onSkip={() => {
            if (videos.length > 1) setVideos((prev) => [...prev.slice(1), prev[0]]);
            else load();
          }}
          onQueued={(v, f) => {
            setFlash(f);
            afterLeave(v);
          }}
          onRemoved={(v) => {
            setFlash(null);
            afterLeave(v);
          }}
        />
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-8 text-center space-y-2">
          <p className="text-sm text-[var(--text)]">Nothing to review right now.</p>
          <p className="text-xs text-[var(--text-faint)]">Add a channel (or wait for the next check for new videos) and its videos will show up here.</p>
        </div>
      )}
    </div>
  );
}
