import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { formatTimeAgo } from "@/lib/utils";
import type { NewsEvent } from "@/lib/news-types";
import { EVENT_STATUS_LABELS } from "@/lib/news-types";
import { Newspaper, ArrowRight, Clock, Zap, ChevronRight, TrendingUp, Video } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewsDashboardPage() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("events")
    .select(
      "id, event_title, social_headline, status, global_relevance_score, golden_window_hours, created_at, video_id, thumbnail"
    )
    .order("golden_window_hours", { ascending: true, nullsFirst: false })
    .order("global_relevance_score", { ascending: false });

  const events = (data || []) as NewsEvent[];

  const needsReview = events.filter((e) => e.status === "unprocessed" || e.status === "processing");
  const reviewed = events.filter((e) => e.status === "reviewed");
  const paused = events.filter((e) => e.status === "paused");
  const convertedToVideo = events.filter((e) => !!e.video_id).length;

  // Most time-urgent unreviewed items - what needs eyes right now.
  const urgent = needsReview.filter((e) => e.golden_window_hours != null).slice(0, 5);
  const recentlyReviewed = reviewed.slice(0, 5);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-3">
            <Newspaper className="w-7 h-7 text-[var(--color-cyan)]" />
            News Pipeline
          </h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{today}</p>
        </div>
        <Link
          href="/news/events"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-cyan-soft)] text-[var(--color-cyan)] hover:bg-[var(--color-cyan)] hover:text-white transition-all duration-200 text-sm font-semibold border border-[var(--color-cyan)]/30 hover:border-[var(--color-cyan)]"
        >
          <span>Review Events</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Needs Review</p>
          <span className="text-3xl font-bold text-[var(--text)] tabular-nums">{needsReview.length}</span>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Reviewed</p>
          <span className="text-3xl font-bold text-[var(--text)] tabular-nums">{reviewed.length}</span>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Paused</p>
          <span className="text-3xl font-bold text-[var(--text)] tabular-nums">{paused.length}</span>
        </div>
        <div className="card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">Turned Into Videos</p>
          <span className="text-3xl font-bold text-[var(--text)] tabular-nums">{convertedToVideo}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--color-amber)]" />
            <h2 className="font-semibold text-[var(--text)]">Most Time-Sensitive</h2>
          </div>
          <div className="space-y-1">
            {urgent.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">Nothing urgent waiting on review.</p>}
            {urgent.map((event) => (
              <Link
                key={event.id}
                href={`/news/events/${event.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--color-amber-soft)] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[var(--color-amber)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {event.social_headline || event.event_title || `Event #${event.id}`}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    Window closes in {event.golden_window_hours}h · {EVENT_STATUS_LABELS[event.status]}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--color-green)]" />
            <h2 className="font-semibold text-[var(--text)]">Recently Reviewed</h2>
          </div>
          <div className="space-y-1">
            {recentlyReviewed.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">Nothing reviewed yet.</p>}
            {recentlyReviewed.map((event) => (
              <Link
                key={event.id}
                href={`/news/events/${event.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group"
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--color-green-soft)] flex items-center justify-center">
                  {event.video_id ? (
                    <Video className="w-4 h-4 text-[var(--color-green)]" />
                  ) : (
                    <TrendingUp className="w-4 h-4 text-[var(--color-green)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">
                    {event.social_headline || event.event_title || `Event #${event.id}`}
                  </p>
                  <p className="text-[11px] text-[var(--text-faint)]">
                    {event.video_id ? "Turned into a video" : "Reviewed"} · {formatTimeAgo(event.created_at)}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
