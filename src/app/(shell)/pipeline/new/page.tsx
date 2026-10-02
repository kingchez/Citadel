"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTimeToSeconds, formatSeconds } from "@/lib/repurpose-utils";
import { classifyVideoUrl } from "@/lib/video-source";
import { MAX_SOURCES } from "@/lib/repurpose-sources";
import { SUPPORTED_CHANNELS, type SubtitleChoice } from "@/lib/repurpose-types";

type Mode = "repurpose" | "new";
type IntroMode = "keep_original" | "replace";
type VideoKind = "single" | "merge";

function Choice<T extends string>({
  value,
  current,
  onSelect,
  children,
}: {
  value: T;
  current: T;
  onSelect: (v: T) => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
        active
          ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]"
          : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}

export default function AddVideoPage() {
  const router = useRouter();

  const [channels, setChannels] = useState<string[]>([]);
  const [videoType, setVideoType] = useState<"vertical-shorts" | "horizontal-long">("vertical-shorts");
  const [channel, setChannel] = useState("");
  const [mode, setMode] = useState<Mode>("repurpose");
  const [title, setTitle] = useState("");
  const [videoKind, setVideoKind] = useState<VideoKind>("single");
  const [sourceUrls, setSourceUrls] = useState<string[]>([""]);
  const [introMode, setIntroMode] = useState<IntroMode>("keep_original");
  const [introUrl, setIntroUrl] = useState("");
  const [introStart, setIntroStart] = useState("");
  const [productsRaw, setProductsRaw] = useState("");
  const [subtitles, setSubtitles] = useState<SubtitleChoice>("later");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedLines, setFailedLines] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ message: string; lines: string[]; href: string } | null>(null);

  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data: { channels?: string[] }) => {
        const list = data.channels || [];
        setChannels(list);
        setChannel((prev) => prev || (list.includes("Viral Shop") ? "Viral Shop" : ""));
      })
      .catch(() => setError("Couldn't load channels."));
  }, []);

  const supported = (SUPPORTED_CHANNELS as readonly string[]).includes(channel);
  const startSeconds = useMemo(() => parseTimeToSeconds(introStart), [introStart]);
  const downloadNote = (url: string) => {
    const kind = url.trim() ? classifyVideoUrl(url) : "direct";
    return kind === "direct" ? null : `${kind === "youtube" ? "YouTube" : "TikTok"} link - it will be downloaded automatically before splitting.`;
  };

  // Single video = one link; merge = at least two. The kind switch keeps what was typed.
  const changeKind = (k: VideoKind) => {
    setVideoKind(k);
    setSourceUrls((prev) => (k === "single" ? [prev[0] ?? ""] : prev.length >= 2 ? prev : [...prev, ""]));
  };
  const setUrlAt = (i: number, v: string) => setSourceUrls((prev) => prev.map((u, idx) => (idx === i ? v : u)));
  const activeUrls = videoKind === "single" ? sourceUrls.slice(0, 1) : sourceUrls;

  const canSubmit =
    supported &&
    !!title.trim() &&
    (mode === "new" ||
      (activeUrls.length >= 1 &&
        activeUrls.every((u) => !!u.trim()) &&
        (introMode === "keep_original" || (!!introUrl.trim() && startSeconds !== null))));

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setFailedLines([]);
    try {
      const res = await fetch("/api/pipeline/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          title,
          channel,
          video_type: videoType,
          subtitles,
          products_raw: productsRaw,
          ...(mode === "repurpose"
            ? {
                source_video_urls: activeUrls.map((u) => u.trim()),
                intro_mode: introMode,
                ...(introMode === "replace" ? { new_intro_url: introUrl, new_intro_start: introStart } : {}),
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setFailedLines(data.failed || []);
        return;
      }
      const href = data.mode === "new" ? `/pipeline/videos/${data.video.id}` : "/pipeline/repurpose";
      const p = data.products as { error?: string; failed?: string[] } | null;
      if (p && (p.error || (p.failed && p.failed.length > 0))) {
        // Created fine, but some/all products need attention - say so before leaving the page.
        setNotice({
          message: p.error
            ? `Video created, but the products couldn't be added: ${p.error} You can add them from the video page.`
            : "Video created. These product links/ASINs couldn't be read (the rest were added):",
          lines: p.failed || [],
          href,
        });
        return;
      }
      router.push(href);
    } catch {
      setError("Network error - nothing was saved.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[var(--text)]">Add Video</h1>
        <p className="text-sm text-[var(--text-faint)] mt-1">
          Insert a new Viral Shop video, or queue an existing one to be repurposed.
        </p>
      </div>

      <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-6 space-y-6">
        <Field label="Video type">
          <div className="flex gap-2">
            <Choice value="vertical-shorts" current={videoType} onSelect={setVideoType}>
              Short (vertical)
            </Choice>
            <Choice value="horizontal-long" current={videoType} onSelect={setVideoType}>
              Long (horizontal)
            </Choice>
          </div>
        </Field>

        <Field label="Channel">
          <select className="input-field text-sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="">Select a channel…</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {channel && !supported && (
            <p className="text-xs text-[var(--color-amber)]">Only Viral Shop is supported on this page for now.</p>
          )}
        </Field>

        {supported && (
          <>
            <Field label="Kind">
              <div className="flex gap-2">
                <Choice value="repurpose" current={mode} onSelect={setMode}>
                  Repurpose
                </Choice>
                <Choice value="new" current={mode} onSelect={setMode}>
                  New
                </Choice>
              </div>
            </Field>

            <Field label="Title">
              <input
                className="input-field text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Working title for this video"
                maxLength={200}
              />
            </Field>

            {mode === "repurpose" && (
              <>
                <Field label="Kind of video">
                  <div className="flex gap-2">
                    <Choice value="single" current={videoKind} onSelect={changeKind}>
                      Single video
                    </Choice>
                    <Choice value="merge" current={videoKind} onSelect={changeKind}>
                      Merge several videos
                    </Choice>
                  </div>
                </Field>

                <Field
                  label={videoKind === "merge" ? "Videos to merge (in order)" : "Original video link"}
                  hint="Each link: Google Drive, a YouTube or TikTok link, or a direct link to the video file (storage bucket, CDN...). Must be reachable without signing in."
                >
                  <div className="space-y-2">
                    {activeUrls.map((u, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex gap-2 items-center">
                          {videoKind === "merge" && (
                            <span className="text-xs font-semibold text-[var(--text-faint)] w-14 flex-shrink-0">Video {i + 1}</span>
                          )}
                          <input
                            className="input-field text-sm font-mono flex-1"
                            value={u}
                            onChange={(e) => setUrlAt(i, e.target.value)}
                            placeholder="https://…/video.mp4  or  https://drive.google.com/file/d/…"
                          />
                          {videoKind === "merge" && activeUrls.length > 2 && (
                            <button
                              type="button"
                              onClick={() => setSourceUrls((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-xs text-[var(--text-faint)] hover:text-[var(--color-red)] px-2"
                              aria-label={`Remove video ${i + 1}`}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        {downloadNote(u) && <p className="text-xs text-[var(--color-purple)] pl-0">{downloadNote(u)}</p>}
                      </div>
                    ))}
                    {videoKind === "merge" && activeUrls.length < MAX_SOURCES && (
                      <button
                        type="button"
                        onClick={() => setSourceUrls((prev) => [...prev, ""])}
                        className="text-xs font-medium text-[var(--color-purple)] hover:underline"
                      >
                        + Add another video
                      </button>
                    )}
                  </div>
                </Field>

                <Field label="Intro">
                  <div className="flex gap-2">
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
                      <input
                        className="input-field text-sm font-mono"
                        value={introUrl}
                        onChange={(e) => setIntroUrl(e.target.value)}
                        placeholder="https://…/intro.mp4  or  https://drive.google.com/file/d/…"
                      />
                      {downloadNote(introUrl) && <p className="text-xs text-[var(--color-purple)]">{downloadNote(introUrl)}</p>}
                    </Field>
                    <Field
                      label="Start cutting from"
                      hint={
                        startSeconds !== null
                          ? `Starts at ${formatSeconds(startSeconds)} in the new intro. The planning agent trims as much as the original intro is long.`
                          : "Format like 0:13 or 1:05."
                      }
                    >
                      <input
                        className="input-field text-sm font-mono w-40"
                        value={introStart}
                        onChange={(e) => setIntroStart(e.target.value)}
                        placeholder="0:00"
                      />
                      {introStart.trim() && startSeconds === null && (
                        <p className="text-xs text-[var(--color-red)]">Not a valid time.</p>
                      )}
                    </Field>
                  </div>
                )}
              </>
            )}

            <Field label="Affiliate products" hint="Optional. Paste Amazon URLs or ASINs, one per line or comma separated.">
              <textarea
                className="input-field text-sm resize-none font-mono"
                rows={4}
                value={productsRaw}
                onChange={(e) => setProductsRaw(e.target.value)}
                placeholder="https://www.amazon.com/dp/B0XXXXXXXX"
              />
            </Field>

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

        {notice && (
          <div className="rounded-xl bg-[var(--color-amber-soft)] border border-[var(--color-amber)]/30 px-4 py-3 text-sm text-[var(--color-amber)] space-y-2">
            <p>{notice.message}</p>
            {notice.lines.length > 0 && (
              <ul className="font-mono text-xs list-disc pl-5">
                {notice.lines.map((l) => (
                  <li key={l} className="break-all">
                    {l}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn-primary text-xs" onClick={() => router.push(notice.href)}>
              Continue
            </button>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/30 px-4 py-3 text-sm text-[var(--color-red)] space-y-1">
            <p>{error}</p>
            {failedLines.length > 0 && (
              <ul className="font-mono text-xs list-disc pl-5">
                {failedLines.map((l) => (
                  <li key={l} className="break-all">
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="btn-primary flex items-center gap-2" disabled={!canSubmit || submitting || !!notice} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {mode === "repurpose" ? "Add to repurpose queue" : "Add video"}
          </button>
        </div>
      </div>
    </div>
  );
}
