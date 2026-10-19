"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { parseVideoNotes, readOption } from "@/lib/video-notes";
import { OPTION_DEFS, type OptionKey } from "@/lib/video-options";

const MAX_NOTE_LENGTH = 2000;

/** Notes tab on a video: its options, its notes (add / edit / delete) and the other pipeline details (edit / delete). */
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
  const [optionBusy, setOptionBusy] = useState<OptionKey | null>(null);

  const setOption = async (key: OptionKey, value: string) => {
    setOptionBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/options`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: value === "" ? null : value }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Couldn't save the option.");
      else onUpdated();
    } catch {
      setError("Network error - the option wasn't saved.");
    } finally {
      setOptionBusy(null);
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
        setError(data.error || "Couldn't save the change.");
        return;
      }
      setEditingKey(null);
      onUpdated();
    } catch {
      setError("Network error - the change wasn't saved.");
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
      if (!res.ok) setError(data.error || "Couldn't delete it.");
      else onUpdated();
    } catch {
      setError("Network error - nothing was deleted.");
    } finally {
      setDeleteBusy(false);
      setDeleteKey(null);
    }
  };

  const startEdit = (key: string, current: string) => {
    setEditingKey(key);
    setEditText(current);
    setError(null);
  };

  const actions = (key: string, current: string, label: string, canEdit: boolean) => (
    <div className="flex gap-1">
      {canEdit && (
        <button type="button" className="btn-ghost" aria-label={`Edit ${label}`} onClick={() => startEdit(key, current)}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
      <button type="button" className="btn-ghost" aria-label={`Delete ${label}`} onClick={() => setDeleteKey(key)}>
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const editor = (rows: number) => (
    <div className="space-y-2">
      <textarea className="input-field text-sm resize-none" rows={rows} value={editText} onChange={(e) => setEditText(e.target.value)} maxLength={MAX_NOTE_LENGTH} autoFocus />
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
  );

  const deleting = deleteKey ? details.find((d) => d.key === deleteKey)?.key ?? list.find((n) => n.key === deleteKey)?.key : null;
  const deletingNote = list.find((n) => n.key === deleteKey);

  return (
    <div className="space-y-4 max-w-3xl">
      {error && <div className="rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/30 px-4 py-3 text-sm text-[var(--color-red)]">{error}</div>}

      <div className="card p-4 sm:p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Video options</p>
        {OPTION_DEFS.map((def) => {
          const current = readOption(notes, def.key);
          const known = current === "" || def.values.includes(current);
          return (
            <div key={def.key} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)]">{def.label}</p>
                <p className="text-xs text-[var(--text-faint)]">{def.hint}</p>
              </div>
              <div className="flex items-center gap-2">
                {optionBusy === def.key && <Loader2 className="w-4 h-4 animate-spin text-[var(--text-faint)]" />}
                <select className="input-field text-sm sm:!w-48" value={current} disabled={optionBusy !== null} onChange={(e) => setOption(def.key, e.target.value)} aria-label={def.label}>
                  <option value="">Decide later</option>
                  {!known && <option value={current}>{current}</option>}
                  {def.values.map((v) => (
                    <option key={v} value={v}>
                      {v === "yes" ? "Yes" : v === "no" ? "No" : v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

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
                {editingKey !== n.key && actions(n.key, n.text, `note ${n.number}`, true)}
              </div>
              {editingKey === n.key ? editor(4) : <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{n.text}</p>}
            </li>
          ))}
        </ul>
      )}

      {details.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Pipeline details</p>
          {details.map((d) => (
            <div key={d.key} className="rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-mono text-[var(--text-faint)]">{d.key}</p>
                {editingKey !== d.key && actions(d.key, d.value, d.key, d.editable)}
              </div>
              {editingKey === d.key ? editor(3) : <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap break-words max-h-48 overflow-y-auto">{d.value}</p>}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deletingNote ? "Delete this note?" : "Delete this detail?"}
        message={deletingNote ? "The note is removed from the video for good." : `“${deleteKey}” is removed from the video's notes for good. The pipeline may rely on it.`}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteKey(null)}
      />
    </div>
  );
}
