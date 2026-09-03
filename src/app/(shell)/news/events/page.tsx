"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { NewsEvent } from "@/lib/news-types";
import { EVENT_STATUS_LABELS, EVENT_STATUS_COLORS } from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { Search, ChevronRight, Clock, Video, Newspaper, TrendingUp } from "lucide-react";

const TABS = [
  { key: "all", label: "All" },
  { key: "needs_review", label: "Needs Review" },
  { key: "reviewed", label: "Reviewed" },
  { key: "paused", label: "Paused" },
];

function matchesView(event: NewsEvent, view: string): boolean {
  switch (view) {
    case "needs_review":
      return event.status === "unprocessed" || event.status === "processing";
    case "reviewed":
      return event.status === "reviewed";
    case "paused":
      return event.status === "paused";
    default:
      return true;
  }
}

function EventRow({ event }: { event: NewsEvent }) {
  const color = EVENT_STATUS_COLORS[event.status];
  return (
    <Link
      href={`/news/events/${event.id}`}
      className="group flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-all duration-150"
    >
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: `var(--color-${color})`, boxShadow: `0 0 6px var(--color-${color}-glow)` }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text)] truncate">
            {event.social_headline || event.event_title || `Event #${event.id}`}
          </h3>
          {event.video_id && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-green-soft)] text-[var(--color-green)] border border-[var(--color-green)]/30 flex-shrink-0">
              <Video className="w-3 h-3" />
              Video
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          {event.global_relevance_score != null && (
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {event.global_relevance_score.toFixed(1)}
            </span>
          )}
          {event.golden_window_hours != null && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {event.golden_window_hours}h window
              </span>
            </>
          )}
        </p>
      </div>

      <div className="flex-shrink-0">
        <span className={`badge badge-${color} text-[10px]`}>{EVENT_STATUS_LABELS[event.status]}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(event.created_at)}</span>
        <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors" />
      </div>
    </Link>
  );
}

function EventsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("view") || "all";
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState<NewsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("view");
    else params.set("view", tab);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    fetch("/api/news/events")
      .then((r) => r.json())
      .then((data: { events?: NewsEvent[] }) => setEvents(data.events || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = events.filter((e) => matchesView(e, activeTab));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.social_headline || "").toLowerCase().includes(q) ||
          (e.event_title || "").toLowerCase().includes(q) ||
          String(e.id).includes(q)
      );
    }
    return list;
  }, [events, activeTab, search]);

  const tabCounts = useMemo(
    () => ({
      all: events.length,
      needs_review: events.filter((e) => matchesView(e, "needs_review")).length,
      reviewed: events.filter((e) => matchesView(e, "reviewed")).length,
      paused: events.filter((e) => matchesView(e, "paused")).length,
    }),
    [events]
  );

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-3">
          <Newspaper className="w-7 h-7 text-[var(--color-cyan)]" />
          News Events
        </h1>
        <p className="mt-1 text-sm text-[var(--text-faint)]">{events.length} total events</p>
      </div>

      <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit overflow-x-auto">
        {TABS.map((tab) => {
          const count = tabCounts[tab.key as keyof typeof tabCounts];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`tab flex items-center gap-2 ${activeTab === tab.key ? "tab-active" : ""}`}
            >
              {tab.label}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-[var(--border)] text-[var(--text-faint)]"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by headline or event ID..."
          className="input-field pl-11 py-3"
        />
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-faint)]">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium">No events found</p>
          </div>
        ) : (
          filtered.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  );
}

export default function NewsEventsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-[var(--text-faint)]">Loading...</div>}>
      <EventsContent />
    </Suspense>
  );
}
