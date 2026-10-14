"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BellRing, CalendarClock, Check, Loader2, Pause, Pencil, Play, Plus, Repeat, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ScheduleCalendar } from "@/components/schedule-calendar";
import {
  DURATION_OPTIONS,
  KINDS,
  KIND_LABEL,
  REMIND_OPTIONS,
  REPEATS,
  REPEAT_LABEL,
  type ScheduleItem,
  type ScheduleKind,
  type ScheduleRepeat,
} from "@/lib/schedule-types";

const KIND_BADGE: Record<ScheduleKind, string> = {
  duty: "badge-purple",
  meeting: "badge-cyan",
  task: "badge-amber",
  other: "badge-gray",
};

function toLocalInput(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayLabel(d: Date): string {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === tomorrow.toDateString()) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function countdown(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const text =
    mins < 1 ? "now" : mins < 60 ? `${mins} min` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d ${Math.floor((mins % 1440) / 60)}h`;
  if (mins < 1) return "starting now";
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

function Choice<T extends string | number>({
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
      aria-pressed={active}
      className={cn(
        "px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
        active
          ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]"
          : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[var(--text-faint)]">{hint}</p>}
    </div>
  );
}

interface FormState {
  title: string;
  notes: string;
  kind: ScheduleKind;
  starts: string;
  duration: number;
  remind: number | null;
  priority: 1 | 2 | 3;
  repeat: ScheduleRepeat;
  until: string;
}

function defaultForm(): FormState {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { title: "", notes: "", kind: "duty", starts: toLocalInput(d), duration: 60, remind: 30, priority: 2, repeat: "none", until: "" };
}

function ItemModal({ item, onClose, onSaved }: { item: ScheduleItem | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<FormState>(() =>
    item
      ? {
          title: item.title,
          notes: item.notes ?? "",
          kind: item.kind,
          starts: item.next_at ? toLocalInput(item.next_at) : "",
          duration: item.duration_minutes,
          remind: item.remind_before_minutes,
          priority: item.priority,
          repeat: item.repeat,
          until: item.repeat_until ? toLocalInput(item.repeat_until).slice(0, 10) : "",
        }
      : defaultForm()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setError(null);
    if (!form.title.trim()) return setError("Give it a title.");
    if (!form.starts && form.kind !== "task") return setError("Pick a start date and time.");
    setSaving(true);
    try {
      const body = {
        title: form.title,
        notes: form.notes,
        kind: form.kind,
        starts_at: form.starts ? new Date(form.starts).toISOString() : null,
        duration_minutes: form.duration,
        remind_before_minutes: form.starts ? form.remind : null,
        priority: form.priority,
        repeat: form.starts ? form.repeat : "none",
        // "until" is a date: keep the whole of that day included
        repeat_until: form.repeat !== "none" && form.until ? new Date(`${form.until}T23:59:59`).toISOString() : null,
      };
      const res = await fetch(item ? `/api/schedule/${item.id}` : "/api/schedule", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Couldn't save.");
      else onSaved();
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-[var(--text)]">{item ? "Edit entry" : "New entry"}</h3>
          <button onClick={onClose} className="btn-ghost" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <Field label="Title">
          <input className="input-field" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Night duty, Review rendered videos" autoFocus />
        </Field>

        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {KINDS.map((k) => (
              <Choice key={k} value={k} current={form.kind} onSelect={(v) => set("kind", v)}>
                {KIND_LABEL[k]}
              </Choice>
            ))}
          </div>
        </Field>

        <Field label="Priority">
          <div className="flex flex-wrap gap-2">
            {([1, 2, 3] as const).map((p) => (
              <Choice key={p} value={p} current={form.priority} onSelect={(v) => set("priority", v)}>
                {p === 1 ? "High" : p === 2 ? "Normal" : "Low"}
              </Choice>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label={form.kind === "task" ? "Due (optional)" : "Starts"}
            hint={form.kind === "task" ? "Leave empty for an anytime to-do (no alert)." : "Your device's local time (Lagos)."}
          >
            <input type="datetime-local" className="input-field" value={form.starts} onChange={(e) => set("starts", e.target.value)} />
          </Field>
          <Field label="Duration">
            <select className="input-field" value={form.duration} onChange={(e) => set("duration", Number(e.target.value))}>
              {DURATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {(form.kind !== "task" || form.starts) && (
          <Field label="Phone alert" hint="You'll be pinged from this point and re-pinged every 5 minutes until you tap Done.">
            <select className="input-field" value={form.remind ?? "none"} onChange={(e) => set("remind", e.target.value === "none" ? null : Number(e.target.value))}>
              <option value="none">No alert</option>
              {REMIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        {form.starts && (
          <Field label="Repeat">
            <div className="flex flex-wrap gap-2">
              {REPEATS.map((r) => (
                <Choice key={r} value={r} current={form.repeat} onSelect={(v) => set("repeat", v)}>
                  {REPEAT_LABEL[r]}
                </Choice>
              ))}
            </div>
          </Field>
        )}

        {form.starts && form.repeat !== "none" && (
          <Field label="Repeat until (optional)" hint="Leave empty to repeat forever.">
            <input type="date" className="input-field" value={form.until} onChange={(e) => set("until", e.target.value)} />
          </Field>
        )}

        <Field label="Notes (optional)">
          <textarea className="input-field min-h-[80px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="btn-secondary text-sm">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-primary text-sm disabled:opacity-50 inline-flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {item ? "Save changes" : "Add to schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScheduleRow({
  item,
  now,
  history,
  onDone,
  onEdit,
  onDelete,
  onTogglePause,
  busy,
}: {
  item: ScheduleItem;
  now: number;
  history: boolean;
  onDone: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePause: () => void;
  busy: boolean;
}) {
  const start = item.next_at ? new Date(item.next_at).getTime() : null;
  const ringing =
    !history && item.status === "upcoming" && item.active && !item.acknowledged_at && start !== null && item.remind_before_minutes !== null && now >= start - item.remind_before_minutes * 60000;

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 rounded-xl border bg-[var(--surface)]",
        ringing ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)]" : "border-[var(--border)]",
        !item.active && !history && "opacity-60"
      )}
    >
      <div className="w-16 flex-shrink-0 text-center">
        <p className="text-lg font-bold tabular-nums text-[var(--text)]">{item.next_at ? timeLabel(item.next_at) : "Any time"}</p>
        {item.duration_minutes > 0 && <p className="text-[10px] text-[var(--text-faint)]">{item.duration_minutes >= 60 ? `${item.duration_minutes / 60}h` : `${item.duration_minutes}m`}</p>}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text)] truncate">{item.title}</h3>
          <span className={cn("badge", KIND_BADGE[item.kind])}>{KIND_LABEL[item.kind]}</span>
          {item.repeat !== "none" && (
            <span className="badge badge-gray inline-flex items-center gap-1">
              <Repeat className="w-3 h-3" />
              {REPEAT_LABEL[item.repeat]}
            </span>
          )}
          {item.status === "missed" && <span className="badge badge-red">Missed</span>}
          {item.status === "done" && <span className="badge badge-green">Done</span>}
          {!item.active && !history && <span className="badge badge-gray">Paused</span>}
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-1 flex items-center gap-1.5 flex-wrap">
          {history ? (
            <span>
              {item.next_at ? `${dayLabel(new Date(item.next_at))}, ${timeLabel(item.next_at)}` : "No due time"}
            </span>
          ) : (
            <span className={cn(ringing && "text-[var(--color-amber)] font-semibold")}>{item.next_at ? countdown(item.next_at, now) : "No due time"}</span>
          )}
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <BellRing className="w-3 h-3" />
            {item.remind_before_minutes === null ? "No alert" : (REMIND_OPTIONS.find((o) => o.value === item.remind_before_minutes)?.label ?? `${item.remind_before_minutes} min before`)}
          </span>
          {ringing && item.notify_count > 0 && (
            <>
              <span>·</span>
              <span>alerted {item.notify_count}×</span>
            </>
          )}
        </p>
        {item.notes && <p className="text-xs text-[var(--text-muted)] mt-1 break-words">{item.notes}</p>}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {!history && (
          <>
            <button onClick={onDone} disabled={busy} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" />
              Done
            </button>
            <button onClick={onTogglePause} disabled={busy} className="btn-ghost" aria-label={item.active ? "Pause alerts" : "Resume alerts"} title={item.active ? "Pause alerts" : "Resume alerts"}>
              {item.active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button onClick={onEdit} className="btn-ghost" aria-label="Edit">
              <Pencil className="w-4 h-4" />
            </button>
          </>
        )}
        <button onClick={onDelete} disabled={busy} className="btn-ghost hover:!text-[var(--color-red)]" aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function SchedulePage() {
  const viewParam = useSearchParams().get("view");
  const view = viewParam === "history" ? "history" : viewParam === "calendar" ? "calendar" : "upcoming";
  const history = view === "history";
  const calendar = view === "calendar";

  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ScheduleItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch(`/api/schedule?view=${view === "calendar" ? "all" : view}`)
        .then((r) => r.json())
        .then((data: { items?: ScheduleItem[]; error?: string }) => {
          if (data.error) setError(data.error);
          else {
            setError(null);
            setItems(data.items || []);
          }
        })
        .catch(() => setError("Couldn't load the schedule."))
        .finally(() => setLoading(false)),
    [view]
  );

  useEffect(() => {
    load();
    const refresh = setInterval(load, 20000);
    const tick = setInterval(() => setNow(Date.now()), 15000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [load]);

  const act = async (id: string, request: () => Promise<Response>) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await request();
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "That didn't work.");
      } else {
        await load();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusyId(null);
    }
  };

  const markDone = (item: ScheduleItem) => act(item.id, () => fetch(`/api/schedule/${item.id}/ack`, { method: "POST" }));
  const togglePause = (item: ScheduleItem) =>
    act(item.id, () =>
      fetch(`/api/schedule/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      })
    );
  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    await act(target.id, () => fetch(`/api/schedule/${target.id}`, { method: "DELETE" }));
    setDeleting(null);
  };

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; items: ScheduleItem[] }>();
    for (const item of items) {
      const d = item.next_at ? new Date(item.next_at) : null;
      const key = d ? d.toDateString() : "anytime";
      if (!map.has(key)) map.set(key, { label: d ? dayLabel(d) : "Anytime", items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  const ringingCount = history ? 0 : items.filter((i) => i.status === "upcoming" && i.active && !i.acknowledged_at && i.next_at !== null && i.remind_before_minutes !== null && now >= new Date(i.next_at).getTime() - i.remind_before_minutes * 60000).length;

  return (
    <div className={cn("p-6 mx-auto space-y-6", calendar ? "max-w-6xl" : "max-w-3xl")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">{history ? "Schedule history" : "Schedule & Duties"}</h1>
          <p className="text-sm text-[var(--text-faint)] mt-1">
            {history ? "Finished and missed entries." : "Your timetable. You get a phone alert before each entry, repeated until you tap Done."}
          </p>
        </div>
        {!history && (
          <button onClick={() => setCreating(true)} className="btn-primary text-sm inline-flex items-center gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            New entry
          </button>
        )}
      </div>

      <div className="flex gap-2">
        {[
          { href: "/schedule", label: "Upcoming", active: view === "upcoming" },
          { href: "/schedule?view=calendar", label: "Calendar", active: calendar },
          { href: "/schedule?view=history", label: "History", active: history },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
              t.active
                ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]"
                : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-strong)]"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {ringingCount > 0 && (
        <div className="rounded-xl border border-[var(--color-amber)] bg-[var(--color-amber-soft)] px-4 py-3 text-sm text-[var(--color-amber)] flex items-center gap-2">
          <BellRing className="w-4 h-4" />
          {ringingCount} {ringingCount === 1 ? "entry is" : "entries are"} alerting you now. Tap Done to stop the pings.
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : calendar ? (
        <ScheduleCalendar items={items} onSelect={setEditing} />
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center text-sm text-[var(--text-faint)]">
          <CalendarClock className="w-6 h-6 mx-auto mb-2 text-[var(--border-strong)]" />
          {history ? "Nothing in the history yet." : "Nothing scheduled. Add your first duty or meeting."}
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label + g.items[0].id} className="space-y-2">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">{g.label}</h2>
              {g.items.map((item) => (
                <ScheduleRow
                  key={item.id}
                  item={item}
                  now={now}
                  history={history}
                  busy={busyId === item.id}
                  onDone={() => markDone(item)}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                  onTogglePause={() => togglePause(item)}
                />
              ))}
            </section>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ItemModal
          item={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Delete this entry?"
        message={deleting ? `"${deleting.title}" will be removed${deleting.repeat !== "none" ? " along with all its repeats" : ""}. This can't be undone.` : ""}
        confirmLabel="Delete"
        danger
        busy={!!busyId}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--text-faint)]">Loading schedule…</div>}>
      <SchedulePage />
    </Suspense>
  );
}
