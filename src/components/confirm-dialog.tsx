"use client";

import { AlertTriangle } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button for the heavier actions (e.g. redo everything). */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Small "are you sure?" modal, styled like the script editor's retry prompt. */
export function ConfirmDialog({ open, title, message, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-[var(--color-amber-soft)] flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-[var(--color-amber)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">{title}</h3>
            <p className="text-sm text-[var(--text-muted)] mt-1">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="btn-secondary text-sm py-2 px-4">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={(danger ? "btn-danger" : "btn-amber") + " text-sm py-2 px-4 disabled:opacity-50"}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
