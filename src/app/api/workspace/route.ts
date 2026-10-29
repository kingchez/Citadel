import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeVideoCounts, hasAnyError, needsReview as videoNeedsReview } from "@/lib/video-stats";
import { deriveNotifications } from "@/lib/notifications";
import { DONE_STATUSES, type VideoRow } from "@/lib/types";
import type { WorkspaceSummary } from "@/lib/workspace-types";

export const dynamic = "force-dynamic";

/** One call that feeds the whole Workspace dashboard. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const horizon = new Date(now.getTime() + 8 * 24 * 3600 * 1000);

    const [alertsRes, doneRes, scheduleRes, videosRes, eventsRes] = await Promise.all([
      supabase.from("workspace_notifications").select("*").eq("status", "open").order("last_seen_at", { ascending: false }).limit(60),
      // done today = anything ticked off / acknowledged today (duties, meetings and to-dos alike)
      supabase.from("citadel_schedule_items").select("id", { count: "exact", head: true }).eq("status", "done").gte("acknowledged_at", startOfToday.toISOString()),
      supabase
        .from("citadel_schedule_items")
        .select("*")
        .eq("status", "upcoming")
        .eq("active", true)
        // next 8 days + anything overdue + anytime to-dos (next_at is null)
        .or(`next_at.lte.${horizon.toISOString()},next_at.is.null`)
        .order("next_at", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("videos")
        .select("id, title, channel, status, vps_in_use, vps_current_service, error_details, script_segments, voice_timing, media_assets, revision_history, created_at, updated_at"),
      supabase.from("events").select("id, event_title, social_headline, status, golden_window_hours, video_id, created_at"),
    ]);

    const firstError = [alertsRes, scheduleRes, videosRes, eventsRes].find((r) => r.error)?.error;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const videos = (videosRes.data || []) as unknown as VideoRow[];
    const counts = computeVideoCounts(videos);
    const liveIssues = deriveNotifications(videos).length;
    const active = videos.find((v) => v.vps_in_use);

    // average hours from created to last update across finished videos
    const finished = videos.filter((v) => DONE_STATUSES.includes(v.status));
    const avgTurnaroundHours =
      finished.length > 0
        ? finished.reduce((sum, v) => sum + (new Date(v.updated_at).getTime() - new Date(v.created_at).getTime()) / 3600000, 0) / finished.length
        : null;
    const recent = [...videos]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 6)
      .map((v) => ({ id: v.id, title: v.title, channel: v.channel ?? "", status: v.status, updated_at: v.updated_at, hasError: hasAnyError(v) }));

    const events = (eventsRes.data || []) as {
      id: string;
      event_title: string | null;
      social_headline: string | null;
      status: string;
      golden_window_hours: number | null;
      video_id: string | null;
      created_at: string;
    }[];
    const unreviewed = events.filter((e) => e.status === "unprocessed" || e.status === "processing");

    const summary: WorkspaceSummary = {
      now: now.toISOString(),
      alerts: (alertsRes.data || []) as WorkspaceSummary["alerts"],
      doneToday: doneRes.count ?? 0,
      schedule: (scheduleRes.data || []) as WorkspaceSummary["schedule"],
      videos: {
        total: counts.total,
        errors: counts.errors,
        progress: counts.progress,
        review: counts.review,
        done: counts.done,
        liveIssues,
        needsReview: videos
          .filter((v) => videoNeedsReview(v))
          .slice(0, 5)
          .map((v) => ({ id: v.id, title: v.title, status: v.status })),
        avgTurnaroundHours,
        recent,
        activeJob: active ? { id: active.id, title: active.title, service: active.vps_current_service ?? null } : null,
      },
      news: {
        needsReview: unreviewed.length,
        paused: events.filter((e) => e.status === "paused").length,
        reviewed: events.filter((e) => e.status === "reviewed").length,
        converted: events.filter((e) => !!e.video_id).length,
        recentlyReviewed: events
          .filter((e) => e.status === "reviewed")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((e) => ({ id: e.id, title: e.social_headline || e.event_title || `Event #${e.id}`, toVideo: !!e.video_id, created_at: e.created_at })),
        urgent: unreviewed
          .filter((e) => e.golden_window_hours != null)
          .sort((a, b) => (a.golden_window_hours ?? 0) - (b.golden_window_hours ?? 0))
          .slice(0, 5)
          .map((e) => ({ id: e.id, title: e.social_headline || e.event_title || "Untitled event", hours: e.golden_window_hours })),
      },
    };

    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
