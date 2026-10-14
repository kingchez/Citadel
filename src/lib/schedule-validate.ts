import { KINDS, REPEATS, type ScheduleKind, type ScheduleRepeat } from "@/lib/schedule-types";

export interface ScheduleInput {
  title?: string;
  notes?: string | null;
  kind?: ScheduleKind;
  starts_at?: string | null;
  duration_minutes?: number;
  remind_before_minutes?: number | null;
  priority?: 1 | 2 | 3;
  repeat?: ScheduleRepeat;
  repeat_until?: string | null;
  active?: boolean;
}

type Parsed = { ok: true; value: ScheduleInput } | { ok: false; error: string };

function isoOrNull(v: unknown): string | null | undefined {
  if (v === null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function intInRange(v: unknown, min: number, max: number): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return undefined;
  return n;
}

/** Validates a create (partial = false) or edit (partial = true) body. */
export function parseScheduleBody(body: unknown, partial: boolean): Parsed {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const out: ScheduleInput = {};

  if (!partial || "title" in b) {
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!title) return { ok: false, error: "A title is required." };
    if (title.length > 200) return { ok: false, error: "Title is too long (max 200 characters)." };
    out.title = title;
  }

  if ("notes" in b) {
    if (b.notes !== null && typeof b.notes !== "string") return { ok: false, error: "Notes must be text." };
    const notes = typeof b.notes === "string" ? b.notes.trim() : null;
    out.notes = notes ? notes.slice(0, 2000) : null;
  }

  if (!partial || "kind" in b) {
    const kind = (b.kind ?? "duty") as ScheduleKind;
    if (!KINDS.includes(kind)) return { ok: false, error: "Unknown kind." };
    out.kind = kind;
  }

  if (!partial || "starts_at" in b) {
    const iso = isoOrNull(b.starts_at);
    if (iso === undefined) return { ok: false, error: "That start date and time isn't valid." };
    if (iso === null && !partial && (b.kind ?? "duty") !== "task") {
      return { ok: false, error: "A start date and time is required (only to-dos can have no time)." };
    }
    out.starts_at = iso;
  }

  if (!partial || "duration_minutes" in b) {
    const n = intInRange(b.duration_minutes ?? 60, 0, 1440);
    if (n === undefined) return { ok: false, error: "Duration must be between 0 and 1440 minutes." };
    out.duration_minutes = n;
  }

  if (!partial || "remind_before_minutes" in b) {
    if (b.remind_before_minutes === null || b.remind_before_minutes === "none") {
      out.remind_before_minutes = null;
    } else {
      const n = intInRange(b.remind_before_minutes ?? 30, 0, 10080);
      if (n === undefined) return { ok: false, error: "Reminder must be between 0 minutes and 7 days before." };
      out.remind_before_minutes = n;
    }
  }

  if (!partial || "repeat" in b) {
    const repeat = (b.repeat ?? "none") as ScheduleRepeat;
    if (!REPEATS.includes(repeat)) return { ok: false, error: "Repeat must be none, daily or weekly." };
    out.repeat = repeat;
  }

  if ("repeat_until" in b) {
    const iso = isoOrNull(b.repeat_until);
    if (iso === undefined) return { ok: false, error: "Invalid repeat-until date." };
    out.repeat_until = iso;
  }

  if ("priority" in b) {
    const p = intInRange(b.priority, 1, 3);
    if (p === undefined) return { ok: false, error: "Priority must be 1 (high), 2 (normal) or 3 (low)." };
    out.priority = p as 1 | 2 | 3;
  }

  if ("active" in b) {
    if (typeof b.active !== "boolean") return { ok: false, error: "active must be true or false." };
    out.active = b.active;
  }

  return { ok: true, value: out };
}
