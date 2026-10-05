"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Film, Loader2, Plus, Repeat, RotateCcw, Tag } from "lucide-react";
import { RepurposeStatusBadge } from "@/components/repurpose-status-badge";
import { cn, formatTimeAgo } from "@/lib/utils";
import { formatSeconds } from "@/lib/repurpose-utils";
import { sourceStage, introStage, type RepurposeSource, type SourceState } from "@/lib/repurpose-sources";
import { REPURPOSE_ERROR_STATUSES, type RepurposeRow, type RepurposeStatus } from "@/lib/repurpose-types";

const CARD_CLASS = "rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden";
const TOP_CLASS = "group flex items-center gap-4 px-5 py-4 transition-all duration-150";
// A video can be added only while nothing is actively running on the item.
const CAN_ADD: RepurposeStatus[] = ["pending_download", "download_error", "pending_split", "split_error", "split_done", "voice_timing_error", "voice_timing_done"];
const KIND_LABEL = { youtube: "YouTube", tiktok: "TikTok", direct: "Direct link" } as const;
const CHIP: Record<SourceState, string> = {
  done: "bg-[var(--color-green-soft)] text-[var(--color-green)] border-[var(--color-green)]/30",
  pending: "bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border)]",
  error: "bg-[var(--color-red-soft)] text-[var(--color-red)] border-[var(--color-red)]/40",
};

function StateChip({ label, state }: { label: string; state: SourceState }) {
  return <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium whitespace-nowrap", CHIP[state])}>{label}</span>;
}

/** The three signals shown next to every video's link: downloaded?, split?, voice-timed? */
function SourceChips({ s }: { s: RepurposeSource }) {
  const dl =
    s.kind === "direct" ? (
      <StateChip label="No download needed" state="done" />
    ) : (
      <StateChip label={s.download === "done" ? "Downloaded" : s.download === "error" ? "Download failed" : "Not downloaded yet"} state={s.download} />
    );
  return (
    <>
      {dl}
      <StateChip label={s.split === "done" ? "Split" : s.split === "error" ? "Split failed" : "Not split yet"} state={s.split} />
      <StateChip label={s.timing === "done" ? "Voice timed" : s.timing === "error" ? "Timing failed" : "Not timed yet"} state={s.timing} />
    </>
  );
}


function RepurposeCard({ item, onChanged }: { item: RepurposeRow; onChanged: () => void }) {
  const isError = REPURPOSE_ERROR_STATUSES.includes(item.status);
  const hasError = isError && !!item.error_details;
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const sources = item.sources ?? [];
  const canAdd = CAN_ADD.includes(item.status);

  const retry = async (e: React.MouseEvent) => {
    // The top of the card is a link to the video - don't navigate when pressing Retry.
    e.preventDefault();
    e.stopPropagation();
    setRetrying(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Retry failed.");
      else onChanged();
    } catch {
      setActionError("Network error.");
    } finally {
      setRetrying(false);
    }
  };

  const addVideo = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Couldn't add the video.");
      else {
        setNewUrl("");
        setAdding(false);
        onChanged();
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const top = (
    <>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text)] truncate">{item.title}</h3>
        <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{item.channel}</span>
          <span>·</span>
          <span>{sources.length > 1 ? `Merge of ${sources.length} videos` : "Single video"}</span>
          <span>·</span>
          <span>
            {item.intro_mode === "replace" && item.new_intro_start_seconds !== null
              ? `New intro from ${formatSeconds(Number(item.new_intro_start_seconds))}`
              : "Original intro"}
          </span>
          {item.video?.with_product && (
            <>
              <span>·</span>
              <span className="text-[var(--color-purple)]">
                <Tag className="w-3 h-3 inline mr-0.5" />
                {(item.video.product_ids ?? []).length} product{(item.video.product_ids ?? []).length === 1 ? "" : "s"}
              </span>
            </>
          )}
          <span>·</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
            {item.video_id ?? item.id}
          </span>
        </p>
        {hasError && (
          <p className="text-xs text-[var(--color-red)] mt-1 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{item.error_details}</span>
          </p>
        )}
      </div>
      <div className="flex-shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">
          <Film className="w-3.5 h-3.5" />
          {item.video_type === "vertical-shorts" ? "Vertical" : "Horizontal"}
        </span>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {isError && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--color-red)]/40 text-xs font-medium text-[var(--color-red)] hover:bg-[var(--color-red-soft)] disabled:opacity-50"
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Retry
          </button>
        )}
        <RepurposeStatusBadge status={item.status} />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(item.updated_at)}</span>
        <ChevronRight className={cn("w-4 h-4 text-[var(--border-strong)] transition-colors", item.video_id && "group-hover:text-[var(--color-purple)]")} />
      </div>
    </>
  );

  return (
    <div className={CARD_CLASS}>
      {/* The top of the card opens the linked video, same as the All Videos list. */}
      {item.video_id ? (
        <Link href={`/pipeline/videos/${item.video_id}`} className={cn(TOP_CLASS, "hover:bg-[var(--surface-raised)]")}>
          {top}
        </Link>
      ) : (
        <div className={TOP_CLASS}>{top}</div>
      )}

      {/* One line per video: its own progress, so a failed one is easy to spot. */}
      <div className="border-t border-[var(--border)] px-5 py-3 space-y-1.5 bg-[var(--surface-raised)]/40">
        {sources.map((s) => {
          const stage = sourceStage(s);
          return (
            <div key={s.index} className="text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-muted)] w-14">Video {s.index + 1}</span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                  {KIND_LABEL[s.kind]}
                </span>
                <SourceChips s={s} />
                <span className="text-[var(--text-faint)] truncate max-w-[40ch]">{s.original_url}</span>
              </div>
              {stage.detail && <p className="text-[var(--color-red)] mt-0.5 pl-16 break-words">{stage.detail}</p>}
            </div>
          );
        })}

        {item.intro_mode === "replace" && item.new_intro_original_url && (() => {
          const intro = item.new_intro_original_url;
          const stage = introStage(intro);
          return (
            <div className="text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-muted)] w-14">Intro</span>
                <span className="px-1.5 py-0.5 rounded bg-[var(--surface)] border border-[var(--border)] text-[10px] text-[var(--text-muted)]">
                  {KIND_LABEL[intro.kind]}
                </span>
                {intro.kind === "direct" ? (
                  <StateChip label="No download needed" state="done" />
                ) : (
                  <StateChip label={intro.download === "done" ? "Downloaded" : intro.download === "error" ? "Download failed" : "Not downloaded yet"} state={intro.download} />
                )}
                <span className="text-[var(--text-faint)] truncate max-w-[40ch]">{intro.original_url}</span>
              </div>
              {stage.detail && <p className="text-[var(--color-red)] mt-0.5 pl-16 break-words">{stage.detail}</p>}
            </div>
          );
        })()}

        {canAdd && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-purple)] hover:underline"
          >
            <Plus className="w-3.5 h-3.5" /> Add another video
          </button>
        )}
        {adding && (
          <div className="flex gap-2 items-center pt-1">
            <input
              className="input-field text-xs font-mono flex-1"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="Link to the extra video (Drive, YouTube, TikTok or a direct file)"
              autoFocus
            />
            <button type="button" className="btn-primary text-xs" disabled={!newUrl.trim() || saving} onClick={addVideo}>
              {saving ? "Adding…" : "Add"}
            </button>
            <button type="button" className="text-xs text-[var(--text-faint)] hover:underline" onClick={() => { setAdding(false); setNewUrl(""); }}>
              Cancel
            </button>
          </div>
        )}
        {!canAdd && item.status !== "handed_off" && item.status !== "cancelled" && (
          <p className="text-[11px] text-[var(--text-faint)]">A step is running - another video can be added when it finishes.</p>
        )}
        {actionError && <p className="text-xs text-[var(--color-red)]">{actionError}</p>}
      </div>
    </div>
  );
}

export default function RepurposeQueuePage() {
  const [items, setItems] = useState<RepurposeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/repurpose")
      .then((r) => r.json())
      .then((data: { items?: RepurposeRow[]; error?: string }) => {
        setError(data.error ?? null);
        setItems(data.items || []);
      })
      .catch(() => setError("Couldn't load the repurpose queue."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // Keep statuses fresh so a finished download clears its red signal on its own.
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Repurpose Queue</h1>
          <p className="text-sm text-[var(--text-faint)] mt-1">
            Existing videos being downloaded, split, timed and handed to the main pipeline. Merged items show every video&apos;s own progress.
          </p>
        </div>
        <Link href="/pipeline/new" className="btn-primary text-sm">
          Add Video
        </Link>
      </div>

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center text-sm text-[var(--text-faint)]">
          <Repeat className="w-6 h-6 mx-auto mb-2 text-[var(--border-strong)]" />
          Nothing queued yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RepurposeCard key={item.id} item={item} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
