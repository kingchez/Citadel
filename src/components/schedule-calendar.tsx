"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, REPEAT_LABEL, type ScheduleItem, type ScheduleKind } from "@/lib/schedule-types";
import { addDays, occurrencesInRange, startOfDay, startOfMonth, startOfWeek, type Occurrence } from "@/lib/schedule-occurrences";

type Mode = "day" | "week" | "month";

const KIND_CHIP: Record<ScheduleKind, string> = {
  duty: "bg-[var(--color-purple-soft)] text-[var(--color-purple)]",
  meeting: "bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border-strong)]",
  task: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
  other: "bg-[var(--surface-raised)] text-[var(--text-muted)]",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function Chip({ occ, onSelect, compact }: { occ: Occurrence; onSelect: (item: ScheduleItem) => void; compact?: boolean }) {
  const dim = occ.item.status !== "upcoming" || !occ.item.active;
  return (
    <button
      type="button"
      onClick={() => onSelect(occ.item)}
      title={`${timeLabel(occ.start)} ${occ.item.title}`}
      className={cn(
        "w-full text-left rounded-md px-1.5 py-0.5 truncate transition-opacity hover:opacity-80",
        compact ? "text-[10px] leading-4" : "text-xs py-1",
        KIND_CHIP[occ.item.kind],
        dim && "opacity-50 line-through"
      )}
    >
      <span className="font-semibold tabular-nums">{timeLabel(occ.start)}</span> {occ.item.title}
    </button>
  );
}

export function ScheduleCalendar({ items, onSelect }: { items: ScheduleItem[]; onSelect: (item: ScheduleItem) => void }) {
  const [mode, setMode] = useState<Mode>("month");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (mode === "week") {
      const s = startOfWeek(anchor);
      return { from: s, to: addDays(s, 7) };
    }
    const s = startOfWeek(startOfMonth(anchor));
    return { from: s, to: addDays(s, 42) };
  }, [mode, anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of occurrencesInRange(items, from, to)) {
      const key = occ.start.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(occ);
    }
    return map;
  }, [items, from, to]);

  const todayKey = new Date().toDateString();

  const move = (dir: -1 | 1) => {
    setAnchor((a) => {
      if (mode === "day") return addDays(a, dir);
      if (mode === "week") return addDays(a, dir * 7);
      return new Date(a.getFullYear(), a.getMonth() + dir, 1);
    });
  };

  const openDay = (d: Date) => {
    setAnchor(startOfDay(d));
    setMode("day");
  };

  const label =
    mode === "month"
      ? anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : mode === "week"
        ? `${startOfWeek(anchor).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const days = Array.from({ length: mode === "month" ? 42 : mode === "week" ? 7 : 1 }, (_, i) => addDays(from, i));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => move(-1)} className="btn-ghost" aria-label="Previous">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => move(1)} className="btn-ghost" aria-label="Next">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setAnchor(startOfDay(new Date()))} className="btn-secondary text-xs py-1.5 px-3">
            Today
          </button>
          <h2 className="text-base font-semibold text-[var(--text)] ml-1">{label}</h2>
        </div>
        <div className="flex gap-1.5">
          {(["day", "week", "month"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-medium border capitalize transition-all duration-150",
                mode === m
                  ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "month" && (
        <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-center">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const occs = byDay.get(d.toDateString()) ?? [];
              const inMonth = d.getMonth() === anchor.getMonth();
              const isToday = d.toDateString() === todayKey;
              return (
                <div key={i} className={cn("min-h-[92px] p-1.5 border-b border-r border-[var(--border)] space-y-1", !inMonth && "bg-[var(--bg)] opacity-60")}>
                  <button
                    onClick={() => openDay(d)}
                    className={cn(
                      "text-xs font-semibold w-6 h-6 rounded-full flex items-center justify-center",
                      isToday ? "bg-[var(--color-purple)] text-white" : "text-[var(--text-muted)] hover:bg-[var(--surface-raised)]"
                    )}
                    aria-label={`Open ${d.toDateString()}`}
                  >
                    {d.getDate()}
                  </button>
                  {occs.slice(0, 3).map((o) => (
                    <Chip key={o.key} occ={o} onSelect={onSelect} compact />
                  ))}
                  {occs.length > 3 && (
                    <button onClick={() => openDay(d)} className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] px-1">
                      +{occs.length - 3} more
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === "week" && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((d, i) => {
            const occs = byDay.get(d.toDateString()) ?? [];
            const isToday = d.toDateString() === todayKey;
            return (
              <div key={i} className={cn("rounded-xl border bg-[var(--surface)] p-2.5 space-y-1.5 min-h-[120px]", isToday ? "border-[var(--color-purple)]" : "border-[var(--border)]")}>
                <button onClick={() => openDay(d)} className="text-left w-full">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{d.toLocaleDateString("en-GB", { weekday: "short" })}</p>
                  <p className={cn("text-lg font-bold", isToday ? "text-[var(--color-purple)]" : "text-[var(--text)]")}>{d.getDate()}</p>
                </button>
                {occs.length === 0 ? <p className="text-xs text-[var(--text-faint)]">Free</p> : occs.map((o) => <Chip key={o.key} occ={o} onSelect={onSelect} />)}
              </div>
            );
          })}
        </div>
      )}

      {mode === "day" && (
        <div className="space-y-2">
          {(byDay.get(anchor.toDateString()) ?? []).length === 0 ? (
            <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center text-sm text-[var(--text-faint)]">Nothing scheduled this day.</div>
          ) : (
            (byDay.get(anchor.toDateString()) ?? []).map((o) => (
              <button
                key={o.key}
                onClick={() => onSelect(o.item)}
                className={cn(
                  "w-full text-left flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors",
                  (o.item.status !== "upcoming" || !o.item.active) && "opacity-60"
                )}
              >
                <div className="w-16 flex-shrink-0 text-center">
                  <p className="text-lg font-bold tabular-nums text-[var(--text)]">{timeLabel(o.start)}</p>
                  {o.item.duration_minutes > 0 && (
                    <p className="text-[10px] text-[var(--text-faint)]">{o.item.duration_minutes >= 60 ? `${o.item.duration_minutes / 60}h` : `${o.item.duration_minutes}m`}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--text)] truncate">{o.item.title}</h3>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", KIND_CHIP[o.item.kind])}>{KIND_LABEL[o.item.kind]}</span>
                    {o.item.repeat !== "none" && (
                      <span className="text-[10px] text-[var(--text-faint)] inline-flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {REPEAT_LABEL[o.item.repeat]}
                      </span>
                    )}
                  </div>
                  {o.item.notes && <p className="text-xs text-[var(--text-muted)] mt-1 break-words">{o.item.notes}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
