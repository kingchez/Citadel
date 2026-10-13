import type { ScheduleItem } from "@/lib/schedule-types";

export interface Occurrence {
  item: ScheduleItem;
  start: Date;
  key: string;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday-first week start. */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;
  return addDays(x, -dow);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * Expands entries into concrete occurrences inside [from, to).
 * One-off entries sit at next_at; repeating ones step from their original start
 * by whole days (daily = 1, weekly = 7), keeping local wall-clock time.
 */
export function occurrencesInRange(items: ScheduleItem[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];

  for (const item of items) {
    if (item.repeat === "none") {
      const start = new Date(item.next_at);
      if (start >= from && start < to) out.push({ item, start, key: `${item.id}:${start.getTime()}` });
      continue;
    }

    const step = item.repeat === "daily" ? 1 : 7;
    const anchor = new Date(item.first_at);
    const until = item.repeat_until ? new Date(item.repeat_until) : null;

    let cur = new Date(anchor);
    if (cur < from) {
      const dayMs = 86400000;
      const k = Math.floor((from.getTime() - cur.getTime()) / dayMs / step);
      cur = addDays(cur, Math.max(0, k - 1) * step);
      let guard = 0;
      while (cur < from && guard++ < 1000) cur = addDays(cur, step);
    }

    let guard = 0;
    while (cur < to && guard++ < 500) {
      if (until && cur > until) break;
      out.push({ item, start: new Date(cur), key: `${item.id}:${cur.getTime()}` });
      cur = addDays(cur, step);
    }
  }

  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}
