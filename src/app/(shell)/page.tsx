"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Circle,
  ExternalLink,
  Info,
  ListTodo,
  Loader2,
  Newspaper,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  Video,
  Zap,
} from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import { KIND_LABEL, type ScheduleItem } from "@/lib/schedule-types";
import { safeLink, type AlertSeverity, type WorkspaceAlert, type WorkspaceSummary } from "@/lib/workspace-types";
import { startOfDay, addDays } from "@/lib/schedule-occurrences";
import { PushToggle } from "@/components/push-toggle";
import { StatusBadge } from "@/components/status-badge";
import { DONE_STATUSES, type VideoStatus } from "@/lib/types";

/* ───────────── helpers ───────────── */

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function countdown(ms: number, now: number): string {
  const diff = ms - now;
  const mins = Math.round(Math.abs(diff) / 60000);
  if (mins < 1) return "now";
  const t = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 1440)}d`;
  return diff >= 0 ? `in ${t}` : `${t} ago`;
}

const SEVERITY: Record<AlertSeverity, { color: string; label: string }> = {
  error: { color: "var(--color-red)", label: "Error" },
  warning: { color: "var(--color-amber)", label: "Warning" },
  action: { color: "var(--color-purple)", label: "Action needed" },
  info: { color: "var(--color-cyan)", label: "Info" },
};

function SeverityIcon({ s }: { s: AlertSeverity }) {
  const cls = "w-5 h-5";
  const style = { color: SEVERITY[s].color };
  if (s === "error") return <AlertTriangle className={cls} style={style} />;
  if (s === "warning") return <AlertCircle className={cls} style={style} />;
  if (s === "action") return <BellRing className={cls} style={style} />;
  return <Info className={cls} style={style} />;
}

/** One row on the Home timeline: a duty, meeting or to-do (all live in the same schedule table). */
interface AgendaEntry {
  key: string;
  id: string;
  title: string;
  at: number | null;
  ringing: boolean;
  item: ScheduleItem;
}

const isTodo = (i: ScheduleItem) => i.kind === "task";

type GroupKey = "overdue" | "today" | "tomorrow" | "week" | "anytime";
const GROUP_LABEL: Record<GroupKey, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  week: "Later this week",
  anytime: "Anytime",
};

function groupOf(e: AgendaEntry, now: number): GroupKey {
  if (e.at === null) return "anytime";
  const today = startOfDay(new Date(now));
  const tomorrow = addDays(today, 1).getTime();
  const dayAfter = addDays(today, 2).getTime();
  if (isTodo(e.item) && e.at < now) return "overdue";
  if (e.at < tomorrow) return "today";
  if (e.at < dayAfter) return "tomorrow";
  return "week";
}

const DONE = new Set<string>(DONE_STATUSES);

const SERVICES = [
  { key: "chatterbox", label: "Chatterbox (voiceover)" },
  { key: "whisperx", label: "WhisperX (timing)" },
  { key: "render", label: "Render Server" },
  { key: "autobrowse", label: "AutoBrowse (media)" },
] as const;

/* ───────────── small pieces ───────────── */

type Tone = "neutral" | "red" | "amber" | "green" | "purple" | "cyan";
const TONE: Record<Tone, string> = {
  neutral: "var(--text)",
  red: "var(--color-red)",
  amber: "var(--color-amber)",
  green: "var(--color-green)",
  purple: "var(--color-purple)",
  cyan: "var(--color-cyan)",
};

/** Compact number tile used in the single stats section. */
function Kpi({ label, value, sub, href, tone = "neutral" }: { label: string; value: string | number; sub?: string; href?: string; tone?: Tone }) {
  const body = (
    <div className="rounded-xl bg-[var(--surface-raised)] border border-transparent px-3 py-2.5 h-full transition-colors hover:border-[var(--border-strong)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-faint)] truncate">{label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight mt-0.5" style={{ color: TONE[tone] }}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-faint)] truncate mt-0.5">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {body}
    </Link>
  ) : (
    <div className="min-w-0">{body}</div>
  );
}

function KpiGroup({ icon, title, meta, href, children }: { icon: React.ReactNode; title: string; meta?: string; href?: string; children: React.ReactNode }) {
  const head = (
    <div className="flex items-center justify-between gap-2 mb-2">
      <h2 className="text-xs font-semibold text-[var(--text)] flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {meta && <span className="text-[11px] text-[var(--text-faint)] flex-shrink-0">{meta}</span>}
    </div>
  );
  return (
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="block hover:opacity-80">
          {head}
        </Link>
      ) : (
        head
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4 gap-2">{children}</div>
    </div>
  );
}

function Panel({ title, icon, action, children, className }: { title: string; icon: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card p-4 space-y-3 min-w-0", className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

const SubLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] uppercase tracking-wider text-[var(--text-faint)] mb-1">{children}</p>
);

function AlertRow({ alert, onResolve, busy }: { alert: WorkspaceAlert; onResolve: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const color = SEVERITY[alert.severity].color;
  const link = safeLink(alert.link_url);
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <div className="p-3.5 flex flex-wrap sm:flex-nowrap items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          <SeverityIcon s={alert.severity} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-[var(--text)]">{alert.title}</h3>
            <span className="badge badge-gray">{alert.source}</span>
            {alert.occurrences > 1 && <span className="badge badge-amber">×{alert.occurrences}</span>}
          </div>
          {alert.details && (
            <button onClick={() => setOpen((o) => !o)} className="text-left w-full">
              <p className={cn("text-xs text-[var(--text-muted)] mt-1 whitespace-pre-wrap break-words", !open && "line-clamp-2")}>{alert.details}</p>
            </button>
          )}
          <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
            {SEVERITY[alert.severity].label} · last seen {formatTimeAgo(alert.last_seen_at)}
            {alert.occurrences > 1 && ` · first seen ${formatTimeAgo(alert.first_seen_at)}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 w-full sm:w-auto justify-end">
          {link &&
            (link.external ? (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="btn-ghost" aria-label="Open">
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <Link href={link.href} className="btn-ghost" aria-label="Open">
                <ExternalLink className="w-4 h-4" />
              </Link>
            ))}
          <button onClick={onResolve} disabled={busy} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────── page ───────────── */

export default function Dashboard() {
  const [data, setData] = useState<WorkspaceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [newsTab, setNewsTab] = useState<"urgent" | "reviewed">("urgent");

  // add-todo form
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<1 | 2 | 3>(2);
  const [remind, setRemind] = useState<string>("0"); // minutes before the due time, or "none"
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      fetch("/api/workspace")
        .then((r) => r.json())
        .then((d: WorkspaceSummary & { error?: string }) => {
          if (d.error) setError(d.error);
          else {
            setError(null);
            setData(d);
          }
        })
        .catch(() => setError("Couldn't load your workspace.")),
    []
  );

  useEffect(() => {
    load();
    const refresh = setInterval(load, 20000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const act = async (key: string, request: () => Promise<Response>) => {
    setBusy(key);
    try {
      const res = await request();
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "That didn't work.");
      } else {
        await load();
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(null);
    }
  };

  const resolveAlert = (a: WorkspaceAlert) => act(a.id, () => fetch(`/api/workspace/notifications/${a.id}/resolve`, { method: "POST" }));
  const markDone = (s: ScheduleItem) => act(s.id, () => fetch(`/api/schedule/${s.id}/ack`, { method: "POST" }));
  const deleteItem = (s: ScheduleItem) => act(s.id, () => fetch(`/api/schedule/${s.id}`, { method: "DELETE" }));

  const addTodo = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      // A to-do is just a schedule entry of type "task" - with a time it alerts you like any other entry.
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          kind: "task",
          starts_at: due ? new Date(due).toISOString() : null,
          duration_minutes: 0,
          remind_before_minutes: due && remind !== "none" ? Number(remind) : null,
          priority,
        }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Couldn't add it.");
      else {
        setTitle("");
        setDue("");
        setPriority(2);
        await load();
      }
    } finally {
      setAdding(false);
    }
  };

  const quickDue = (kind: "1h" | "today6" | "tomorrow9") => {
    const d = new Date();
    if (kind === "1h") d.setHours(d.getHours() + 1, 0, 0, 0);
    if (kind === "today6") d.setHours(18, 0, 0, 0);
    if (kind === "tomorrow9") {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    setDue(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  };

  const entries: AgendaEntry[] = useMemo(() => {
    if (!data) return [];
    const list: AgendaEntry[] = [];
    for (const s of data.schedule) {
      const at = s.next_at ? new Date(s.next_at).getTime() : null;
      list.push({
        key: s.id,
        id: s.id,
        title: s.title,
        at,
        item: s,
        ringing: at !== null && s.remind_before_minutes !== null && !s.acknowledged_at && now >= at - s.remind_before_minutes * 60000,
      });
    }
    return list;
  }, [data, now]);

  const grouped = useMemo(() => {
    const g: Record<GroupKey, AgendaEntry[]> = { overdue: [], today: [], tomorrow: [], week: [], anytime: [] };
    for (const e of entries) g[groupOf(e, now)].push(e);
    (Object.keys(g) as GroupKey[]).forEach((k) =>
      g[k].sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || a.item.priority - b.item.priority)
    );
    return g;
  }, [entries, now]);

  if (!data) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
        <div className="h-9 w-72 rounded-lg bg-[var(--surface)] animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
        {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}
      </div>
    );
  }

  const todayEntries = grouped.today;
  const nextUp = entries.filter((e) => e.at !== null && e.at >= now - 60000).sort((a, b) => a.at! - b.at!)[0];
  const overdueCount = grouped.overdue.length;
  const openTodos = data.schedule.filter(isTodo).length;
  const alertCount = data.alerts.length;
  const sortedAlerts = [...data.alerts].sort((a, b) => {
    const rank: Record<AlertSeverity, number> = { error: 0, action: 1, warning: 2, info: 3 };
    return rank[a.severity] - rank[b.severity] || new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
  });
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const v = data.videos;
  const n = data.news;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] truncate">{greeting()}, Kingsley 👋</h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{today}</p>
        </div>
        <Link href="/schedule" className="btn-secondary text-sm inline-flex items-center gap-2 flex-shrink-0">
          <CalendarClock className="w-4 h-4" />
          <span className="hidden sm:inline">Schedule</span>
        </Link>
      </div>

      <PushToggle />

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {/* All the numbers, one section */}
      <section className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-4 xl:gap-6 md:divide-x md:divide-[var(--border)] md:[&>*:not(:first-child)]:pl-4 xl:[&>*:not(:first-child)]:pl-6">
          <KpiGroup icon={<CalendarClock className="w-3.5 h-3.5 text-[var(--color-purple)]" />} title="Workspace">
            <Kpi label="Attention" value={alertCount} sub={alertCount === 0 ? "All clear" : `${data.alerts.filter((a) => a.severity === "error").length} errors`} tone={alertCount === 0 ? "green" : "red"} />
            <Kpi label="Today" value={todayEntries.length} sub={nextUp ? `${hhmm(nextUp.at!)} ${nextUp.title}` : "Nothing next"} href="/schedule" tone="purple" />
            <Kpi label="To-dos" value={openTodos} sub={overdueCount > 0 ? `${overdueCount} overdue` : "On track"} tone={overdueCount > 0 ? "amber" : "neutral"} />
            <Kpi label="Done today" value={data.doneToday} sub="completed" tone="green" />
          </KpiGroup>

          <KpiGroup icon={<Video className="w-3.5 h-3.5 text-[var(--color-cyan)]" />} title="Video Pipeline" meta={`${v.total} total`} href="/pipeline/videos">
            <Kpi label="Errors" value={v.errors} href="/pipeline/videos?view=errors" tone={v.errors > 0 ? "red" : "neutral"} />
            <Kpi label="In progress" value={v.progress} href="/pipeline/videos?view=progress" tone="cyan" />
            <Kpi label="Review" value={v.review} href="/pipeline/videos?view=review" tone="amber" />
            <Kpi label="Done" value={v.done} href="/pipeline/videos?view=done" tone="green" />
          </KpiGroup>

          <KpiGroup icon={<Newspaper className="w-3.5 h-3.5 text-[var(--color-cyan)]" />} title="News Pipeline" href="/news/events">
            <Kpi label="To review" value={n.needsReview} href="/news/events?view=needs_review" tone={n.needsReview > 0 ? "cyan" : "neutral"} />
            <Kpi label="Reviewed" value={n.reviewed} href="/news/events?view=reviewed" tone="green" />
            <Kpi label="Paused" value={n.paused} href="/news/events" tone={n.paused > 0 ? "amber" : "neutral"} />
            <Kpi label="Videos" value={n.converted} sub="from news" href="/news/events" tone="purple" />
          </KpiGroup>
        </div>
      </section>

      {/* Main: my work on the left, pipeline status on the right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          {/* Alerts */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--color-red)]" />
                Needs your attention
                {alertCount > 0 && <span className="badge badge-red">{alertCount}</span>}
              </h2>
              {data.videos.liveIssues > 0 && (
                <Link href="/notifications" className="text-xs text-[var(--color-purple)] hover:opacity-80 inline-flex items-center gap-1">
                  {data.videos.liveIssues} live video issue{data.videos.liveIssues === 1 ? "" : "s"}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
            {sortedAlerts.length === 0 ? (
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--text-faint)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--color-green)] flex-shrink-0" />
                All clear. Alerts from your n8n workflows land here and leave when you resolve them.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedAlerts.map((a) => (
                  <AlertRow key={a.id} alert={a} busy={busy === a.id} onResolve={() => resolveAlert(a)} />
                ))}
              </div>
            )}
          </section>

          {/* My day */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-[var(--color-purple)]" />
                My day
                <span className="text-xs font-normal text-[var(--text-faint)]">
                  {openTodos} to-do{openTodos === 1 ? "" : "s"}
                  {overdueCount > 0 && ` · ${overdueCount} overdue`}
                  {data.doneToday > 0 && ` · ${data.doneToday} done today`}
                </span>
              </h2>
              <Link href="/schedule" className="text-xs text-[var(--color-purple)] inline-flex items-center gap-1 hover:opacity-80">
                Schedule <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="card p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  className="input-field flex-1"
                  placeholder="Add to your day… (press Enter)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                />
                <button onClick={addTodo} disabled={adding || !title.trim()} className="btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Add
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input type="datetime-local" className="input-field !w-auto text-xs" value={due} onChange={(e) => setDue(e.target.value)} />
                {([
                  ["1h", "In 1 hour"],
                  ["today6", "Today 6pm"],
                  ["tomorrow9", "Tomorrow 9am"],
                ] as const).map(([k, label]) => (
                  <button key={k} onClick={() => quickDue(k)} className="text-xs px-2.5 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-strong)]">
                    {label}
                  </button>
                ))}
                <select className="input-field !w-auto text-xs" value={priority} onChange={(e) => setPriority(Number(e.target.value) as 1 | 2 | 3)}>
                  <option value={1}>High priority</option>
                  <option value={2}>Normal</option>
                  <option value={3}>Low</option>
                </select>
                {due && (
                  <select className="input-field !w-auto text-xs" value={remind} onChange={(e) => setRemind(e.target.value)}>
                    <option value="none">No alert</option>
                    <option value="0">Alert at due time</option>
                    <option value="15">Alert 15 min before</option>
                    <option value="30">Alert 30 min before</option>
                    <option value="60">Alert 1 hour before</option>
                  </select>
                )}
              </div>
            </div>

            {(Object.keys(GROUP_LABEL) as GroupKey[]).every((k) => grouped[k].length === 0) ? (
              <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-8 text-center text-sm text-[var(--text-faint)]">
                Your day is empty. Add a to-do above, or schedule a duty in{" "}
                <Link href="/schedule" className="text-[var(--color-purple)]">
                  Schedule
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-5">
                {(Object.keys(GROUP_LABEL) as GroupKey[])
                  .filter((k) => grouped[k].length > 0)
                  .map((k) => (
                    <div key={k} className="space-y-1.5">
                      <h3 className={cn("text-[11px] font-semibold uppercase tracking-wider", k === "overdue" ? "text-[var(--color-red)]" : "text-[var(--text-faint)]")}>
                        {GROUP_LABEL[k]} · {grouped[k].length}
                      </h3>
                      {grouped[k].map((e) => (
                        <div
                          key={e.key}
                          className={cn(
                            "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border bg-[var(--surface)]",
                            e.ringing ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)]" : "border-[var(--border)]"
                          )}
                        >
                          {isTodo(e.item) ? (
                            <button onClick={() => markDone(e.item)} disabled={busy === e.id} aria-label="Mark done" className="text-[var(--text-faint)] hover:text-[var(--color-green)] flex-shrink-0">
                              {busy === e.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Circle className="w-5 h-5" />}
                            </button>
                          ) : (
                            <CalendarClock className="w-5 h-5 text-[var(--color-purple)] flex-shrink-0" />
                          )}
                          <div className="w-14 flex-shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{e.at !== null ? hhmm(e.at) : "—"}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[var(--text)] truncate flex items-center gap-2">
                              {e.item.priority === 1 && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-red)] flex-shrink-0" title="High priority" />}
                              <span className="truncate">{e.title}</span>
                              {!isTodo(e.item) && <span className="badge badge-purple flex-shrink-0">{KIND_LABEL[e.item.kind]}</span>}
                            </p>
                            {e.at !== null && (
                              <p className={cn("text-[11px] mt-0.5", e.ringing || k === "overdue" ? "text-[var(--color-amber)] font-semibold" : "text-[var(--text-faint)]")}>
                                {countdown(e.at, now)}
                                {k === "week" && ` · ${new Date(e.at).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`}
                              </p>
                            )}
                          </div>
                          {!isTodo(e.item) ? (
                            <button onClick={() => markDone(e.item)} disabled={busy === e.id} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
                              <Check className="w-3.5 h-3.5" />
                              Done
                            </button>
                          ) : (
                            <button onClick={() => deleteItem(e.item)} disabled={busy === e.id} aria-label="Delete" className="btn-ghost opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!text-[var(--color-red)]">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 min-w-0">
          <Panel
            title="Pipeline Health"
            icon={<Activity className="w-4 h-4 text-[var(--color-purple)]" />}
            action={<span className="text-[11px] text-[var(--text-faint)]">{v.avgTurnaroundHours !== null ? `Avg ${v.avgTurnaroundHours.toFixed(1)}h per video` : ""}</span>}
          >
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map((svc) => {
                const inUse = v.activeJob?.service === svc.key;
                return (
                  <div key={svc.key} className="rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] px-3 py-2 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn("w-2 h-2 rounded-full flex-shrink-0", inUse && "animate-pulse")}
                        style={{ backgroundColor: inUse ? "var(--color-green)" : "var(--text-faint)", boxShadow: inUse ? "0 0 6px var(--color-green-glow)" : "none" }}
                      />
                      <p className="text-xs font-semibold text-[var(--text)] truncate">{svc.label}</p>
                    </div>
                    <p className="text-[10px] uppercase tracking-wide mt-0.5 pl-4" style={{ color: inUse ? "var(--color-green)" : "var(--text-faint)" }}>
                      {inUse ? "In use" : "Idle"}
                    </p>
                  </div>
                );
              })}
            </div>
            {v.activeJob && (
              <Link href={`/pipeline/videos/${v.activeJob.id}`} className="block text-xs text-[var(--text-muted)] hover:text-[var(--text)] truncate">
                Running now: {v.activeJob.title}
              </Link>
            )}
            {v.needsReview.length > 0 && (
              <div>
                <SubLabel>Waiting for your review</SubLabel>
                {v.needsReview.map((x) => (
                  <Link key={x.id} href={`/pipeline/videos/${x.id}`} className="block text-xs text-[var(--text)] truncate py-0.5 hover:text-[var(--color-purple)]">
                    • {x.title}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Quick links" icon={<ArrowRight className="w-4 h-4 text-[var(--color-purple)]" />}>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ["/pipeline/new", "Add video"],
                ["/pipeline/videos", "All videos"],
                ["/news/events", "Review news"],
                ["/schedule?view=calendar", "Calendar"],
              ].map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg border border-[var(--border)] px-3 py-2 text-center text-[var(--text-muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]">
                  {label}
                </Link>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      {/* Activity: videos and news side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel
          title="Recent Videos"
          icon={<Zap className="w-4 h-4 text-[var(--color-amber)]" />}
          action={
            <Link href="/pipeline/videos" className="text-xs text-[var(--color-purple)] hover:opacity-80 inline-flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          <div className="space-y-0.5 -mx-1">
            {v.recent.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">No videos yet.</p>}
            {v.recent.slice(0, 5).map((x) => (
              <Link key={x.id} href={`/pipeline/videos/${x.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    x.hasError ? "bg-[var(--color-red-soft)]" : DONE.has(x.status) ? "bg-[var(--color-green-soft)]" : "bg-[var(--surface-raised)]"
                  )}
                >
                  {x.hasError ? (
                    <AlertTriangle className="w-4 h-4 text-[var(--color-red)]" />
                  ) : DONE.has(x.status) ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />
                  ) : (
                    <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{x.title}</p>
                  <p className="text-[11px] text-[var(--text-faint)] truncate">
                    {x.channel} · {formatTimeAgo(x.updated_at)}
                  </p>
                </div>
                <div className="hidden min-[420px]:block flex-shrink-0">
                  <StatusBadge status={x.status as VideoStatus} size="sm" showIcon={false} />
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] flex-shrink-0" />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel
          title="News"
          icon={<Newspaper className="w-4 h-4 text-[var(--color-cyan)]" />}
          action={
            <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-[11px]">
              {([
                ["urgent", "Time-sensitive"],
                ["reviewed", "Reviewed"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setNewsTab(k)}
                  className={cn("px-2.5 py-1 rounded-md transition-colors", newsTab === k ? "bg-[var(--surface-raised)] text-[var(--text)] font-semibold" : "text-[var(--text-faint)] hover:text-[var(--text)]")}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="space-y-0.5 -mx-1">
            {newsTab === "urgent" ? (
              <>
                {n.urgent.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">Nothing urgent waiting on review.</p>}
                {n.urgent.map((e) => (
                  <Link key={e.id} href={`/news/events/${e.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-amber-soft)] flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-[var(--color-amber)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{e.title}</p>
                      <p className="text-[11px] text-[var(--text-faint)]">{e.hours != null ? `Window closes in ${Math.round(e.hours)}h` : "No deadline"}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] flex-shrink-0" />
                  </Link>
                ))}
              </>
            ) : (
              <>
                {n.recentlyReviewed.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">Nothing reviewed yet.</p>}
                {n.recentlyReviewed.map((e) => (
                  <Link key={e.id} href={`/news/events/${e.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-green-soft)] flex items-center justify-center flex-shrink-0">
                      {e.toVideo ? <Video className="w-4 h-4 text-[var(--color-green)]" /> : <TrendingUp className="w-4 h-4 text-[var(--color-green)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text)] truncate">{e.title}</p>
                      <p className="text-[11px] text-[var(--text-faint)]">
                        {e.toVideo ? "Turned into a video" : "Reviewed"} · {formatTimeAgo(e.created_at)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] flex-shrink-0" />
                  </Link>
                ))}
              </>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
