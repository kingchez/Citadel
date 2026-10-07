"use client";

import { useState } from "react";
import { X, MessageSquareWarning, Loader2, CheckCircle2, Clock } from "lucide-react";
import { extractDriveFileId, formatTimeAgo } from "@/lib/utils";
import type { RevisionEntry } from "@/lib/types";

interface VideoOutputModalProps {
  videoId: string;
  title: string;
  outputDriveLink: string;
  revisionHistory: RevisionEntry[];
  onClose: () => void;
  onRevisionSubmitted: () => void;
}

export function VideoOutputModal({
  videoId,
  title,
  outputDriveLink,
  revisionHistory,
  onClose,
  onRevisionSubmitted,
}: VideoOutputModalProps) {
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileId = extractDriveFileId(outputDriveLink);

  const handleSubmit = async () => {
    if (!notes.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/revise`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not submit revision.");
      }
      setSubmitted(true);
      setNotes("");
      onRevisionSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="card w-full max-w-[1600px] h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-lg font-bold text-[var(--text)] leading-tight">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-2 flex-shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Left: the video. Right: revision notes. Stacks on narrow screens. */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="min-h-[50vh] lg:min-h-0 bg-black flex flex-col">
            {fileId ? (
              <>
                {/* Google's own player: plays straight from Drive (no proxying through this server, so no size/time limits). */}
                <iframe
                  key={fileId}
                  src={`https://drive.google.com/file/d/${fileId}/preview`}
                  title={title}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                  className="flex-1 w-full border-0 bg-black"
                />
                <div className="px-4 py-2 text-[11px] text-[var(--text-faint)] bg-[var(--surface)] border-t border-[var(--border)]">
                  Not loading yet? Drive can take a minute to process a fresh upload.{" "}
                  <a href={outputDriveLink} target="_blank" rel="noopener noreferrer" className="text-[var(--color-cyan)] underline">
                    Open in Drive
                  </a>
                </div>
              </>
            ) : (
              <div className="p-10 text-center text-[var(--text-faint)] text-sm my-auto">
                Couldn&apos;t read a file id from this output link.{" "}
                <a href={outputDriveLink} target="_blank" rel="noopener noreferrer" className="text-[var(--color-cyan)] underline">
                  Open in Drive instead
                </a>
              </div>
            )}
          </div>

          <div className="flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-[var(--border)]">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              {revisionHistory.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Revision history</p>
                  <div className="space-y-2">
                    {revisionHistory.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-start gap-2.5 p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]"
                      >
                        {entry.status === "resolved" ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] flex-shrink-0 mt-0.5" />
                        ) : (
                          <Clock className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--text)] break-words">{entry.note}</p>
                          <p className="text-[10px] text-[var(--text-faint)] mt-1">
                            {formatTimeAgo(entry.created_at)}
                            {entry.status === "resolved" && entry.resolved_at && ` · resolved ${formatTimeAgo(entry.resolved_at)}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {submitted ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--color-amber-soft)] border border-[var(--color-amber)]/40">
                  <MessageSquareWarning className="w-5 h-5 text-[var(--color-amber)] flex-shrink-0" />
                  <p className="text-sm text-[var(--text)]">
                    Added to the revision history — this item has been moved back to <strong>Revision Requested</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="revision-notes" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Notes for revision (leave blank if this one&apos;s good)
                  </label>
                  <textarea
                    id="revision-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Segment 3's pacing feels rushed, and the b-roll at 0:14 doesn't match the script..."
                    rows={10}
                    className="input-field resize-none"
                  />
                  {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}
                </div>
              )}
            </div>

            {!submitted && (
              <div className="flex justify-end gap-2 p-4 border-t border-[var(--border)]">
                <button onClick={onClose} className="btn-secondary py-2 px-4 text-sm">
                  Close
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!notes.trim() || submitting}
                  className="btn-amber flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Submit for revision
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
