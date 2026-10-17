"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { parseVideoNotes } from "@/lib/video-notes";

const MAX_NOTE_LENGTH = 2000;

/** Notes tab on a video: the notes already there, plus a box to add a new one. */
export function VideoNotesTab({ videoId, notes, onUpdated }: { videoId: string; notes: unknown; onUpdated: () => void }) {
  const { notes: list, details } = parseVideoNotes(notes);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const saveEdit = async () => {
    if (!editingKey) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/notes/${editingKey}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Couldn't save the note.");
        return;
      }
      setEditingKey(null);
      onUpdated();
    } catch {
      setError("Network error - the note wasn't saved.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteKey) return;
    setDeleteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/notes/${deleteKey}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error || "Couldn't delete the note.");
      else onUpdated();
    } catch {
      setError("Network error - the note wasn't deleted.");
    } finally {
      setDeleteBusy(false);
      setDeleteKey(null);
    }
  };

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
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Note {n.number}</p>
                {editingKey !== n.key && (
                  <div className="flex gap-1">
                    <button type="button" className="btn-ghost" aria-label={`Edit note ${n.number}`} onClick={() => { setEditingKey(n.key); setEditText(n.text); setError(null); }}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" className="btn-ghost" aria-label={`Delete note ${n.number}`} onClick={() => setDeleteKey(n.key)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              {editingKey === n.key ? (
                <div className="space-y-2">
                  <textarea className="input-field text-sm resize-none" rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={MAX_NOTE_LENGTH} autoFocus />
                  <div className="flex justify-end gap-2">
                    <button type="button" className="btn-secondary text-sm" disabled={editSaving} onClick={() => setEditingKey(null)}>
                      Cancel
                    </button>
                    <button type="button" className="btn-primary flex items-center gap-2 text-sm" disabled={!editText.trim() || editSaving} onClick={saveEdit}>
                      {editSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{n.text}</p>
              )}
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

      <ConfirmDialog
        open={!!deleteKey}
        title="Delete this note?"
        message="The note is removed from the video for good."
        confirmLabel="Delete note"
        danger
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteKey(null)}
      />
    </div>
  );
}
