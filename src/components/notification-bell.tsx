"use client";

import { useState, useRef, useEffect } from "react";
import { Bell, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { CitadelNotification } from "@/lib/notifications";

function NotificationItem({
  notification,
  read,
  onOpen,
}: {
  notification: CitadelNotification;
  read: boolean;
  onOpen: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const getIcon = () => {
    switch (notification.type) {
      case "error":
        return <AlertTriangle className="w-5 h-5 text-[var(--color-red)]" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-[var(--color-amber)]" />;
      default:
        return <Info className="w-5 h-5 text-[var(--color-cyan)]" />;
    }
  };

  const handleClick = () => {
    if (!read) onOpen(notification.id);
    setExpanded((e) => !e);
  };

  return (
    <a
      href={`/pipeline/videos/${notification.video_id}`}
      className={cn(
        "relative block p-4 rounded-xl cursor-pointer transition-colors",
        !read ? "bg-[var(--color-purple-soft)]/60 border-l-3 border-[var(--color-purple)]" : "bg-transparent hover:bg-[var(--surface-raised)]"
      )}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn("font-medium text-sm truncate", !read && "text-[var(--text)]")}>{notification.title}</h4>
            <span className="text-[10px] text-[var(--text-faint)] flex-shrink-0">{formatTimeAgo(notification.created_at)}</span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)] truncate">{notification.summary}</p>
          <p className="mt-1 text-[11px] text-[var(--text-faint)] font-mono truncate">{notification.video_title}</p>

          {expanded && notification.detail && (
            <div className="mt-3 p-3 rounded-lg bg-[var(--bg)] border border-[var(--border)] animate-fade-in">
              <p className="text-sm text-[var(--text-muted)] whitespace-pre-wrap">{notification.detail}</p>
            </div>
          )}
        </div>
        {!read && <div className="w-2 h-2 rounded-full bg-[var(--color-purple)] flex-shrink-0 mt-1" />}
      </div>
    </a>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CitadelNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const bellRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((data: { notifications?: CitadelNotification[] }) => {
          if (!cancelled) setNotifications(data.notifications || []);
        })
        .catch(() => {});
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const handleMarkRead = (id: string) => setReadIds((prev) => new Set(prev).add(id));
  const handleMarkAllRead = () => setReadIds(new Set(notifications.map((n) => n.id)));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl btn-ghost"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
      >
        <Bell className="w-5 h-5 text-[var(--text-muted)]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-red)] text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={dropdownRef}
          className="notif-dropdown absolute right-0 top-full mt-2 w-96 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden z-50"
          role="menu"
        >
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text)]">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-sm text-[var(--color-purple)] hover:opacity-80 font-medium">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-faint)]">
                <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem key={n.id} notification={n} read={readIds.has(n.id)} onOpen={handleMarkRead} />
              ))
            )}
          </div>

          <div className="p-3 border-t border-[var(--border)]">
            <a
              href="/notifications"
              className="block w-full text-center text-sm text-[var(--color-purple)] hover:opacity-80 font-medium py-2"
              onClick={() => setOpen(false)}
            >
              View all notifications →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
