"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { KIND_LABEL, REPEAT_LABEL, type ScheduleItem, type ScheduleKind } from "@/lib/schedule-types";
import { addDays, occurrencesInRange, startOfDay, startOfMonth, startOfWeek, type Occurrence } from "@/lib/schedule-occurrences";

type Mode = "timetable" | "day" | "week" | "month";

const KIND_CHIP: Record<ScheduleKind, string> = {
  duty: "bg-[var(--color-purple-soft)] text-[var(--color-purple)]",
  meeting: "bg-[var(--surface-raised)] text-[var(--text)] border border-[var(--border-strong)]",
  task: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]",
  other: "bg-[var(--surface-raised)] text-[var(--text-muted)]",
};

const KIND_BORDER: Record<ScheduleKind, string> = {
  duty: "border-l-4 border-l-[var(--color-purple)]",
  meeting: "border-l-4 border-l-cyan-400",
  task: "border-l-4 border-l-[var(--color-amber)]",
  other: "border-l-4 border-l-[var(--border-strong)]",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_HEADERS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday (No Classes)",
  "Saturday (Batch & Schedule)",
  "Sunday (Rest & Buffer)",
];

interface TimeBand {
  id: string;
  label: string;
  sublabel?: string;
  minMinutes: number;
  maxMinutes: number;
}

const MASTER_TIME_BANDS: TimeBand[] = [
  { id: "band-0800", label: "08:00 – 08:30", sublabel: "30 mins · Morning News", minMinutes: 0, maxMinutes: 539 },
  { id: "band-0900", label: "09:30 – 13:00", sublabel: "3.5 hrs · Deep Study / Batch", minMinutes: 540, maxMinutes: 779 },
  { id: "band-1300", label: "13:00 – 15:00", sublabel: "2.0 hrs · Lunch & Rest", minMinutes: 780, maxMinutes: 899 },
  { id: "band-1515", label: "15:15 – 16:15", sublabel: "60 mins · Workout", minMinutes: 900, maxMinutes: 979 },
  { id: "band-1630", label: "16:30 – 18:30", sublabel: "2.0 hrs · Overflow / Bulk Schedule", minMinutes: 980, maxMinutes: 1099 },
  { id: "band-1830", label: "18:30 – 19:45", sublabel: "75 mins · Stage 1 Niche Plan", minMinutes: 1100, maxMinutes: 1199 },
  { id: "band-2000", label: "20:00 – 20:30", sublabel: "30 mins · Evening News", minMinutes: 1200, maxMinutes: 1229 },
  { id: "band-2030", label: "20:30 – 21:15", sublabel: "45 mins · Stage 4 & Checkpoints", minMinutes: 1230, maxMinutes: 1440 },
];

function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function timeRangeLabel(start: Date, durationMinutes: number): string {
  if (!durationMinutes || durationMinutes <= 0) return timeLabel(start);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  return `${timeLabel(start)} – ${timeLabel(end)}`;
}

function durationBadge(mins: number): string {
  if (mins <= 0) return "";
  if (mins % 60 === 0) return `${mins / 60}h`;
  if (mins > 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 30 ? `${h}.5h` : `${h}h ${m}m`;
  }
  return `${mins}m`;
}

function Chip({ occ, onSelect, compact }: { occ: Occurrence; onSelect: (item: ScheduleItem) => void; compact?: boolean }) {
  const dim = occ.item.status !== "upcoming" || !occ.item.active;
  return (
    <button
      type="button"
      onClick={() => onSelect(occ.item)}
      title={`${timeRangeLabel(occ.start, occ.item.duration_minutes)} ${occ.item.title}`}
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
  const [mode, setMode] = useState<Mode>("timetable");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));

  const { from, to } = useMemo(() => {
    if (mode === "day") return { from: anchor, to: addDays(anchor, 1) };
    if (mode === "week" || mode === "timetable") {
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
      if (mode === "week" || mode === "timetable") return addDays(a, dir * 7);
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
      : mode === "week" || mode === "timetable"
        ? `${startOfWeek(anchor).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(startOfWeek(anchor), 6).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const days = Array.from({ length: mode === "month" ? 42 : mode === "week" || mode === "timetable" ? 7 : 1 }, (_, i) => addDays(from, i));

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
          <h2 className="text-sm sm:text-base font-semibold text-[var(--text)] ml-1">{label}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { key: "timetable", label: "Timetable Grid" },
              { key: "day", label: "Day" },
              { key: "week", label: "Week" },
              { key: "month", label: "Month" },
            ] as { key: Mode; label: string }[]
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              aria-pressed={mode === m.key}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-medium border transition-all duration-150",
                mode === m.key
                  ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]"
                  : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "timetable" && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <table className="w-full min-w-[1150px] border-collapse text-left align-top">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
                <th className="w-[155px] p-3 text-xs font-bold uppercase tracking-wider text-[var(--text-faint)] border-r border-[var(--border)]">
                  Time (WAT / UTC+1)
                </th>
                {days.map((d, idx) => {
                  const isToday = d.toDateString() === todayKey;
                  return (
                    <th
                      key={idx}
                      className={cn(
                        "p-3 text-xs font-bold border-r last:border-r-0 border-[var(--border)] min-w-[185px]",
                        isToday ? "bg-[var(--color-purple-soft)]/30 text-[var(--color-purple)]" : "text-[var(--text)]"
                      )}
                    >
                      <button onClick={() => openDay(d)} className="text-left w-full group">
                        <div className="flex items-center justify-between gap-1">
                          <span className="uppercase tracking-wider text-[11px]">{WEEKDAY_HEADERS[idx]}</span>
                          <span
                            className={cn(
                              "text-xs px-1.5 py-0.5 rounded-md font-bold tabular-nums",
                              isToday ? "bg-[var(--color-purple)] text-white" : "text-[var(--text-faint)] group-hover:text-[var(--text)]"
                            )}
                          >
                            {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {MASTER_TIME_BANDS.map((band) => (
                <tr key={band.id} className="hover:bg-[var(--surface-raised)]/30 transition-colors">
                  <td className="p-3 align-top border-r border-[var(--border)] bg-[var(--bg)]/40">
                    <div className="font-bold text-xs sm:text-sm tabular-nums text-[var(--text)]">{band.label}</div>
                    {band.sublabel && <div className="text-[11px] text-[var(--text-faint)] mt-0.5">{band.sublabel}</div>}
                  </td>
                  {days.map((d, dayIdx) => {
                    const isToday = d.toDateString() === todayKey;
                    const dayOccs = (byDay.get(d.toDateString()) ?? []).filter((o) => {
                      const mins = o.start.getHours() * 60 + o.start.getMinutes();
                      return mins >= band.minMinutes && mins <= band.maxMinutes;
                    });
                    return (
                      <td
                        key={dayIdx}
                        className={cn(
                          "p-2.5 align-top border-r last:border-r-0 border-[var(--border)] space-y-2",
                          isToday && "bg-[var(--color-purple-soft)]/10"
                        )}
                      >
                        {dayOccs.length === 0 ? (
                          <div className="text-xs text-[var(--text-faint)]/50 py-2 text-center select-none">—</div>
                        ) : (
                          dayOccs.map((o) => {
                            const dim = o.item.status !== "upcoming" || !o.item.active;
                            return (
                              <button
                                key={o.key}
                                type="button"
                                onClick={() => onSelect(o.item)}
                                className={cn(
                                  "w-full text-left rounded-xl p-2.5 border border-[var(--border)] bg-[var(--bg)]/70 hover:border-[var(--border-strong)] transition-all space-y-1.5 shadow-sm",
                                  KIND_BORDER[o.item.kind],
                                  dim && "opacity-50"
                                )}
                              >
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold tabular-nums text-[var(--text-faint)] inline-flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {timeRangeLabel(o.start, o.item.duration_minutes)}
                                  </span>
                                  {o.item.duration_minutes > 0 && (
                                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", KIND_CHIP[o.item.kind])}>
                                      {durationBadge(o.item.duration_minutes)}
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs font-bold text-[var(--text)] leading-snug">{o.item.title}</div>
                                {o.item.notes && (
                                  <div className="text-[11px] text-[var(--text-muted)] leading-relaxed whitespace-pre-line break-words">
                                    {o.item.notes}
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === "month" && (
        <div className="rounded-2xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]">
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-1 sm:px-2 py-2 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] text-center">
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
                <div key={i} className={cn("min-h-[56px] sm:min-h-[92px] p-1 sm:p-1.5 border-b border-r border-[var(--border)] space-y-1", !inMonth && "bg-[var(--bg)] opacity-60")}>
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
                  {occs.length > 0 && (
                    <button onClick={() => openDay(d)} className="sm:hidden flex flex-wrap gap-0.5 px-0.5" aria-label={`${occs.length} entries`}>
                      {occs.slice(0, 4).map((o) => (
                        <span key={o.key} className="w-1.5 h-1.5 rounded-full bg-[var(--color-purple)]" />
                      ))}
                      {occs.length > 4 && <span className="text-[9px] leading-none text-[var(--text-faint)]">+{occs.length - 4}</span>}
                    </button>
                  )}
                  <div className="hidden sm:block space-y-1">
                    {occs.slice(0, 3).map((o) => (
                      <Chip key={o.key} occ={o} onSelect={onSelect} compact />
                    ))}
                    {occs.length > 3 && (
                      <button onClick={() => openDay(d)} className="text-[10px] text-[var(--text-faint)] hover:text-[var(--text)] px-1">
                        +{occs.length - 3} more
                      </button>
                    )}
                  </div>
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
              <div key={i} className={cn("rounded-xl border bg-[var(--surface)] p-2.5 space-y-2 min-h-[140px]", isToday ? "border-[var(--color-purple)]" : "border-[var(--border)]")}>
                <button onClick={() => openDay(d)} className="text-left w-full border-b border-[var(--border)] pb-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{d.toLocaleDateString("en-GB", { weekday: "short" })}</p>
                  <p className={cn("text-lg font-bold", isToday ? "text-[var(--color-purple)]" : "text-[var(--text)]")}>{d.getDate()}</p>
                </button>
                {occs.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)]">Free</p>
                ) : (
                  occs.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => onSelect(o.item)}
                      className={cn(
                        "w-full text-left rounded-lg p-2 border border-[var(--border)] bg-[var(--bg)]/60 hover:border-[var(--border-strong)] transition-all space-y-1",
                        KIND_BORDER[o.item.kind],
                        (o.item.status !== "upcoming" || !o.item.active) && "opacity-50"
                      )}
                    >
                      <div className="text-[10px] font-bold tabular-nums text-[var(--text-faint)]">
                        {timeRangeLabel(o.start, o.item.duration_minutes)}
                      </div>
                      <div className="text-xs font-semibold text-[var(--text)] leading-snug">{o.item.title}</div>
                      {o.item.notes && <div className="text-[10px] text-[var(--text-muted)] line-clamp-3 whitespace-pre-line">{o.item.notes}</div>}
                    </button>
                  ))
                )}
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
                  "w-full text-left flex items-start gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)] transition-colors",
                  (o.item.status !== "upcoming" || !o.item.active) && "opacity-60"
                )}
              >
                <div className="w-20 flex-shrink-0 text-center pt-0.5">
                  <p className="text-base sm:text-lg font-bold tabular-nums text-[var(--text)]">{timeLabel(o.start)}</p>
                  {o.item.duration_minutes > 0 && (
                    <p className="text-[11px] text-[var(--text-faint)]">{durationBadge(o.item.duration_minutes)}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-[var(--text)]">{o.item.title}</h3>
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", KIND_CHIP[o.item.kind])}>{KIND_LABEL[o.item.kind]}</span>
                    {o.item.repeat !== "none" && (
                      <span className="text-[10px] text-[var(--text-faint)] inline-flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {REPEAT_LABEL[o.item.repeat]}
                      </span>
                    )}
                  </div>
                  {o.item.notes && <p className="text-xs text-[var(--text-muted)] mt-1.5 whitespace-pre-line break-words">{o.item.notes}</p>}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
