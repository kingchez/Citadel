"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Film, Loader2, PackageCheck, Pause, Pencil, Play, Plus, Repeat, RotateCcw, Tag, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { RepurposeStatusBadge } from "@/components/repurpose-status-badge";
import { cn, formatTimeAgo } from "@/lib/utils";
import { formatSeconds, parseTimeToSeconds } from "@/lib/repurpose-utils";
import { sourceStage, introStage, type RepurposeSource, type SourceState } from "@/lib/repurpose-sources";
import { REPURPOSE_ERROR_STATUSES, type RepurposeRow, type RepurposeStatus } from "@/lib/repurpose-types";

const CARD_CLASS = "rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden";
const TOP_CLASS = "group flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 sm:py-4 transition-all duration-150";
// A video can be added only while nothing is actively running on the item.
const CAN_ADD: RepurposeStatus[] = ["waiting_merge", "pending_download", "download_error", "pending_split", "split_error", "split_done", "voice_timing_error", "voice_timing_done"];
// A video's link can be changed or removed only before voice timing starts - after that the timing would be wrong.
const CAN_EDIT_SOURCES: RepurposeStatus[] = ["waiting_merge", "pending_download", "download_error", "pending_split", "split_error", "split_done"];
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
  const [holdBusy, setHoldBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [addKind, setAddKind] = useState<"source" | "intro">("source");
  const [introStart, setIntroStart] = useState("");
  const [saving, setSaving] = useState(false);
  const sources = item.sources ?? [];
  const canAdd = CAN_ADD.includes(item.status);
  const canEditSources = CAN_EDIT_SOURCES.includes(item.status);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [srcBusy, setSrcBusy] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const saveSourceUrl = async () => {
    if (editIndex === null) return;
    setSrcBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/sources/${editIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: editUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Couldn't change the link.");
        return;
      }
      setEditIndex(null);
      onChanged();
    } catch {
      setActionError("Network error - nothing was changed.");
    } finally {
      setSrcBusy(false);
    }
  };

  const deleteSource = async () => {
    if (deleteIndex === null) return;
    setSrcBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/sources/${deleteIndex}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setActionError(data.error || "Couldn't remove the video.");
      else onChanged();
    } catch {
      setActionError("Network error - nothing was removed.");
    } finally {
      setSrcBusy(false);
      setDeleteIndex(null);
    }
  };

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

  // Hold for merge (pending_download -> waiting_merge) / Finish merge (waiting_merge -> pending_download).
  const setHold = async (hold: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setHoldBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hold }),
      });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Couldn't change the hold.");
      else onChanged();
    } catch {
      setActionError("Network error.");
    } finally {
      setHoldBusy(false);
    }
  };

  const addVideo = async () => {
    setSaving(true);
    setActionError(null);
    try {
      // A source video goes into `sources`; an intro goes into the intro fields (never into `sources`).
      const res =
        addKind === "intro"
          ? await fetch(`/api/repurpose/${item.id}/intro`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: newUrl, start: introStart }),
            })
          : await fetch(`/api/repurpose/${item.id}/sources`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: newUrl }),
            });
      const data = await res.json();
      if (!res.ok) setActionError(data.error || "Couldn't add the video.");
      else {
        setNewUrl("");
        setIntroStart("");
        setAddKind("source");
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
      <div className="flex-1 min-w-full sm:min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text)] line-clamp-2 sm:truncate">{item.title}</h3>
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
        {item.status === "pending_download" && (
          <button
            type="button"
            onClick={(e) => setHold(true, e)}
            disabled={holdBusy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] disabled:opacity-50"
          >
            {holdBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
            Hold for merge
          </button>
        )}
        {item.status === "waiting_merge" && (
          <button
            type="button"
            onClick={(e) => setHold(false, e)}
            disabled={holdBusy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-purple)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
          >
            {holdBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Finish merge
          </button>
        )}
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
      <div className="flex items-center gap-2 flex-shrink-0 max-sm:ml-auto">
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

      {/* After voice timing: the products step lives on its own page. */}
      {(item.status === "voice_timing_done" || item.status === "handed_off") && (
        <Link
          href={`/pipeline/products/${item.id}`}
          className={cn(
            "flex items-center gap-2 border-t border-[var(--border)] px-5 py-2.5 text-xs font-medium hover:bg-[var(--surface-raised)]",
            item.products_step === "confirmed" ? "text-[var(--text-muted)]" : "text-[var(--color-purple)]"
          )}
        >
          <PackageCheck className="w-3.5 h-3.5" />
          {item.products_step === "confirmed"
            ? "Products confirmed - view"
            : item.products_step === "extracting"
              ? "Finding the products in this video…"
              : "Products: check them and add the Amazon links"}
          <ChevronRight className="w-3.5 h-3.5 ml-auto" />
        </Link>
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
                {canEditSources && editIndex !== s.index && (
                  <span className="ml-auto flex gap-1">
                    <button type="button" className="btn-ghost" aria-label={`Change the link of video ${s.index + 1}`} onClick={() => { setEditIndex(s.index); setEditUrl(s.original_url); setActionError(null); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {sources.length > 1 && (
                      <button type="button" className="btn-ghost" aria-label={`Remove video ${s.index + 1}`} onClick={() => setDeleteIndex(s.index)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </span>
                )}
              </div>
              {editIndex === s.index && (
                <div className="flex gap-2 items-center pt-1.5 sm:pl-16">
                  <input className="input-field text-xs font-mono flex-1" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://…" autoFocus />
                  <button type="button" className="btn-secondary text-xs" disabled={srcBusy} onClick={() => setEditIndex(null)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary text-xs flex items-center gap-1" disabled={srcBusy || !editUrl.trim()} onClick={saveSourceUrl}>
                    {srcBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save
                  </button>
                </div>
              )}
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
            <Plus className="w-3.5 h-3.5" /> Add another video or intro
          </button>
        )}
        {adding && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-1 text-xs">
              {(["source", "intro"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAddKind(k)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg border font-medium",
                    addKind === k
                      ? "bg-[var(--color-purple)] text-white border-[var(--color-purple)]"
                      : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:bg-[var(--surface-raised)]"
                  )}
                >
                  {k === "source" ? "Source video" : item.new_intro_original_url ? "Intro (replaces current)" : "Intro video"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="input-field text-xs font-mono flex-1"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder={addKind === "intro" ? "Link to the new intro video (Drive, YouTube, TikTok or a direct file)" : "Link to the extra video (Drive, YouTube, TikTok or a direct file)"}
                autoFocus
              />
              {addKind === "intro" && (
                <input
                  className="input-field text-xs font-mono w-28"
                  value={introStart}
                  onChange={(e) => setIntroStart(e.target.value)}
                  placeholder="Start 0:13"
                />
              )}
              <button
                type="button"
                className="btn-primary text-xs"
                disabled={!newUrl.trim() || (addKind === "intro" && parseTimeToSeconds(introStart) === null) || saving}
                onClick={addVideo}
              >
                {saving ? "Adding…" : addKind === "intro" ? "Set intro" : "Add"}
              </button>
              <button type="button" className="text-xs text-[var(--text-faint)] hover:underline" onClick={() => { setAdding(false); setNewUrl(""); setIntroStart(""); setAddKind("source"); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
        {!canAdd && item.status !== "handed_off" && item.status !== "cancelled" && (
          <p className="text-[11px] text-[var(--text-faint)]">A step is running - another video can be added when it finishes.</p>
        )}
        {actionError && <p className="text-xs text-[var(--color-red)]">{actionError}</p>}

        <ConfirmDialog
          open={deleteIndex !== null}
          title={`Remove Video ${deleteIndex !== null ? deleteIndex + 1 : ""}?`}
          message="It is removed from this merge and the remaining videos are renumbered. The item goes back to Pending Download; the other videos keep their progress."
          confirmLabel="Remove video"
          danger
          busy={srcBusy}
          onConfirm={deleteSource}
          onCancel={() => setDeleteIndex(null)}
        />
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
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
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
