"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Info, AlertCircle, Bell, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { formatTimeAgo, formatDate } from "@/lib/utils";
import type { CitadelNotification } from "@/lib/notifications";

function getIcon(type: CitadelNotification["type"]) {
  switch (type) {
    case "error":
      return <AlertTriangle className="w-5 h-5 text-[var(--color-red)]" />;
    case "warning":
      return <AlertCircle className="w-5 h-5 text-[var(--color-amber)]" />;
    default:
      return <Info className="w-5 h-5 text-[var(--color-cyan)]" />;
  }
}

function borderColorVar(type: CitadelNotification["type"]) {
  switch (type) {
    case "error":
      return "var(--color-red)";
    case "warning":
      return "var(--color-amber)";
    default:
      return "var(--color-cyan)";
  }
}

function NotifCard({ notification, read, onMarkRead }: { notification: CitadelNotification; read: boolean; onMarkRead: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const color = borderColorVar(notification.type);

  return (
    <div
      className="card rounded-xl overflow-hidden transition-all duration-150 hover:border-[var(--border-strong)]"
      style={{ borderLeftWidth: 3, borderLeftColor: !read ? "var(--color-purple)" : color }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-2.5 rounded-xl mt-0.5" style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}>
            {getIcon(notification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className={`font-semibold text-sm ${!read ? "text-[var(--text)]" : "text-[var(--text-muted)]"}`}>
                {notification.title}
                {!read && <span className="ml-2 inline-flex w-2 h-2 rounded-full bg-[var(--color-purple)]" />}
              </h3>
              <span className="text-xs text-[var(--text-faint)] flex-shrink-0">{formatTimeAgo(notification.created_at)}</span>
            </div>

            <p className="mt-1 text-sm text-[var(--text-muted)]">{notification.summary}</p>

            <a
              href={`/pipeline/videos/${notification.video_id}`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs text-[var(--color-purple)] hover:opacity-80 font-medium transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {notification.video_title}
            </a>

            {expanded && notification.detail && (
              <div className="mt-3 p-4 rounded-xl bg-[var(--bg)] border border-[var(--border)]">
                <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap leading-relaxed font-mono">{notification.detail}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border)]">
          {notification.detail ? (
            <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors">
              {expanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Collapse details</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>Show details</span>
                </>
              )}
            </button>
          ) : (
            <span />
          )}
          {!read && (
            <button onClick={() => onMarkRead(notification.id)} className="text-xs text-[var(--color-purple)] hover:opacity-80 font-medium transition-colors">
              Mark as read
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function groupByDate(notifications: CitadelNotification[]) {
  const groups: Record<string, CitadelNotification[]> = {};
  for (const n of notifications) {
    const label = formatDate(n.created_at);
    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<CitadelNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data: { notifications?: CitadelNotification[] }) => setNotifications(data.notifications || []));
  }, []);

  const handleMarkRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const handleMarkAllRead = () => setReadIds(new Set(notifications.map((n) => n.id)));

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;
  const displayed = filter === "unread" ? notifications.filter((n) => !readIds.has(n.id)) : notifications;
  const grouped = groupByDate(displayed);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-3">
            <Bell className="w-7 h-7 text-[var(--color-purple)]" />
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={handleMarkAllRead} className="btn-secondary py-2 px-4 text-sm">
            Mark all read
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit">
        {(["all", "unread"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`tab capitalize ${filter === f ? "tab-active" : ""}`}>
            {f === "unread" ? `Unread (${unreadCount})` : "All"}
          </button>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-16 text-[var(--text-faint)]">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium">No notifications</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-faint)] px-1">{date}</h2>
            <div className="space-y-3">
              {items.map((n) => (
                <NotifCard key={n.id} notification={n} read={readIds.has(n.id)} onMarkRead={handleMarkRead} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
