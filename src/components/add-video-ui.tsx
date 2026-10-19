"use client";

import { cn } from "@/lib/utils";
import { DIRECTION_VALUES, type DirectionChoice, type ScriptChoice } from "@/lib/video-options";

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

/** "Change original product video script" and "Product listing direction" - answered like Subtitles (decide later = the agent asks). */
export function ScriptAndDirectionFields({
  script,
  onScript,
  direction,
  onDirection,
}: {
  script: ScriptChoice;
  onScript: (v: ScriptChoice) => void;
  direction: DirectionChoice;
  onDirection: (v: DirectionChoice) => void;
}) {
  return (
    <>
      <Field label="Change original product video script" hint="“Decide later” leaves it for the planning agent to ask.">
        <div className="flex gap-2 flex-wrap">
          <Choice value="yes" current={script} onSelect={onScript}>
            Yes
          </Choice>
          <Choice value="no" current={script} onSelect={onScript}>
            No
          </Choice>
          <Choice value="later" current={script} onSelect={onScript}>
            Decide later
          </Choice>
        </div>
      </Field>

      <Field label="Product listing direction" hint="The order the products are listed in the video. “Decide later” leaves it for the planning agent to ask.">
        <div className="flex gap-2 flex-wrap">
          {DIRECTION_VALUES.map((d) => (
            <Choice key={d} value={d} current={direction} onSelect={onDirection}>
              {d}
            </Choice>
          ))}
          <Choice value="later" current={direction} onSelect={onDirection}>
            Decide later
          </Choice>
        </div>
      </Field>
    </>
  );
}
