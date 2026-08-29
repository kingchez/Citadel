"use client";

import { useState } from "react";
import { Pencil, Check, X, AlertTriangle, RotateCcw } from "lucide-react";
import type { ScriptSegment } from "@/lib/types";

interface ScriptEditorProps {
  videoId: string;
  segments: ScriptSegment[];
  onUpdated: () => void;
}

export function ScriptEditor({ videoId, segments, onUpdated }: ScriptEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmSegment, setConfirmSegment] = useState<{ index: number; text: string } | null>(null);

  const startEdit = (seg: ScriptSegment) => {
    setEditingIndex(seg.index);
    setDraftText(seg.text || "");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraftText("");
  };

  const saveEdit = async (seg: ScriptSegment) => {
    if (draftText === (seg.text || "")) {
      cancelEdit();
      return;
    }
    if (seg.voiceover_drive_file_id) {
      // Ask permission before deciding whether to also queue a retry.
      setConfirmSegment({ index: seg.index, text: draftText });
      return;
    }
    await submitEdit(seg.index, draftText, false);
  };

  const submitEdit = async (index: number, text: string, retry: boolean) => {
    setSaving(true);
    try {
      await fetch(`/api/videos/${videoId}/segments/${index}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, retry }),
      });
      onUpdated();
    } finally {
      setSaving(false);
      setEditingIndex(null);
      setDraftText("");
      setConfirmSegment(null);
    }
  };

  return (
    <div className="space-y-3">
      {segments.map((seg) => (
        <div key={seg.index} className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)]">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-mono text-[var(--text-faint)] font-medium pt-0.5">
              {String(seg.index + 1).padStart(2, "0")}
            </span>
            {editingIndex !== seg.index && (
              <button
                onClick={() => startEdit(seg)}
                className="btn-ghost p-1.5 flex-shrink-0"
                aria-label={`Edit segment ${seg.index + 1}`}
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {editingIndex === seg.index ? (
            <div className="space-y-2">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                className="input-field text-sm resize-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button onClick={cancelEdit} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5" disabled={saving}>
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
                <button
                  onClick={() => saveEdit(seg)}
                  disabled={saving}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed font-mono">
              {seg.text || <span className="italic text-[var(--text-faint)]">No text</span>}
            </p>
          )}
        </div>
      ))}

      {confirmSegment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmSegment(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[var(--color-amber-soft)] flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-[var(--color-amber)]" />
              </div>
              <div>
                <h3 className="font-semibold text-[var(--text)]">Retry this segment&apos;s audio?</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Segment {confirmSegment.index + 1} already has generated audio, and you just changed its text. Regenerate
                  the audio now to match?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => submitEdit(confirmSegment.index, confirmSegment.text, false)}
                disabled={saving}
                className="btn-secondary text-sm py-2 px-4"
              >
                Not now
              </button>
              <button
                onClick={() => submitEdit(confirmSegment.index, confirmSegment.text, true)}
                disabled={saving}
                className="btn-amber text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Save & retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
