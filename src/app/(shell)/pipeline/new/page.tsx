"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTimeToSeconds, formatSeconds } from "@/lib/repurpose-utils";
import { SUPPORTED_CHANNELS, type SubtitleChoice } from "@/lib/repurpose-types";

type Mode = "repurpose" | "new";
type IntroMode = "keep_original" | "replace";

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
  const [sourceUrl, setSourceUrl] = useState("");
  const [introMode, setIntroMode] = useState<IntroMode>("keep_original");
  const [introUrl, setIntroUrl] = useState("");
  const [introStart, setIntroStart] = useState("");
  const [productsRaw, setProductsRaw] = useState("");
  const [subtitles, setSubtitles] = useState<SubtitleChoice>("later");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedLines, setFailedLines] = useState<string[]>([]);

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

  const canSubmit =
    supported &&
    !!title.trim() &&
    (mode === "new" ||
      (!!sourceUrl.trim() && (introMode === "keep_original" || (!!introUrl.trim() && startSeconds !== null))));

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
                source_video_url: sourceUrl,
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
      if (data.mode === "new") router.push(`/pipeline/videos/${data.video.id}`);
      else router.push("/pipeline/repurpose");
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
                <Field label="Original video (Google Drive link)" hint="Link to the video file itself, shared so anyone with the link can view.">
                  <input
                    className="input-field text-sm font-mono"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/…"
                  />
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
                    <Field label="New intro video (Google Drive link)">
                      <input
                        className="input-field text-sm font-mono"
                        value={introUrl}
                        onChange={(e) => setIntroUrl(e.target.value)}
                        placeholder="https://drive.google.com/file/d/…"
                      />
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
          <button type="button" className="btn-primary flex items-center gap-2" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {mode === "repurpose" ? "Add to repurpose queue" : "Add video"}
          </button>
        </div>
      </div>
    </div>
  );
}
