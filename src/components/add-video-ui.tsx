"use client";

import { cn } from "@/lib/utils";

export function Choice<T extends string>({
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

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}

/** Normal / Priority choice. Priority sets `videos.priority`, so the video is picked up ahead of the current queue. */
export function PriorityField({ priority, onChange }: { priority: boolean; onChange: (v: boolean) => void }) {
  return (
    <Field label="Priority" hint="Priority videos jump ahead of whatever is currently in the queue.">
      <div className="flex gap-2">
        <Choice value="normal" current={priority ? "priority" : "normal"} onSelect={() => onChange(false)}>
          Normal
        </Choice>
        <Choice value="priority" current={priority ? "priority" : "normal"} onSelect={() => onChange(true)}>
          Priority
        </Choice>
      </div>
    </Field>
  );
}
