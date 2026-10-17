"use client";

import { useState } from "react";
import { Loader2, Plus, StickyNote } from "lucide-react";
import { parseVideoNotes } from "@/lib/video-notes";

const MAX_NOTE_LENGTH = 2000;

/** Notes tab on a video: the notes already there, plus a box to add a new one. */
export function VideoNotesTab({ videoId, notes, onUpdated }: { videoId: string; notes: unknown; onUpdated: () => void }) {
  const { notes: list, details } = parseVideoNotes(notes);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save the note.");
        return;
      }
      setText("");
      onUpdated();
    } catch {
      setError("Network error - the note wasn't saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="card p-4 sm:p-5 space-y-3">
        <label htmlFor="new-video-note" className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Add a note
        </label>
        <textarea
          id="new-video-note"
          className="input-field text-sm resize-none"
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="Anything the agent should know or do for this video"
        />
        {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
        <div className="flex justify-end">
          <button type="button" className="btn-primary flex items-center justify-center gap-2 text-sm" disabled={!text.trim() || saving} onClick={add}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add note
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card p-8 text-center">
          <StickyNote className="w-10 h-10 mx-auto mb-3 text-[var(--border-strong)]" />
          <p className="text-[var(--text-muted)] font-medium">No notes yet</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li key={n.key} className="card p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] mb-1.5">Note {n.number}</p>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{n.text}</p>
            </li>
          ))}
        </ul>
      )}

      {details.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Pipeline details</p>
          {details.map((d) => (
            <div key={d.key} className="rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] px-4 py-3">
              <p className="text-xs font-mono text-[var(--text-faint)]">{d.key}</p>
              <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{d.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
