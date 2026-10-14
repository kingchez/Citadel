import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeVideoCounts, needsReview as videoNeedsReview } from "@/lib/video-stats";
import { deriveNotifications } from "@/lib/notifications";
import type { VideoRow } from "@/lib/types";
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

    const [alertsRes, todosRes, doneRes, scheduleRes, videosRes, eventsRes] = await Promise.all([
      supabase.from("workspace_notifications").select("*").eq("status", "open").order("last_seen_at", { ascending: false }).limit(60),
      supabase.from("workspace_todos").select("*").eq("status", "open").order("due_at", { ascending: true, nullsFirst: false }).limit(200),
      supabase.from("workspace_todos").select("id", { count: "exact", head: true }).eq("status", "done").gte("done_at", startOfToday.toISOString()),
      supabase
        .from("citadel_schedule_items")
        .select("*")
        .eq("status", "upcoming")
        .eq("active", true)
        .lte("next_at", horizon.toISOString())
        .order("next_at", { ascending: true })
        .limit(100),
      supabase
        .from("videos")
        .select("id, title, status, vps_in_use, vps_current_service, error_details, script_segments, voice_timing, media_assets, revision_history, updated_at"),
      supabase.from("events").select("id, event_title, status, golden_window_hours"),
    ]);

    const firstError = [alertsRes, todosRes, scheduleRes, videosRes, eventsRes].find((r) => r.error)?.error;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const videos = (videosRes.data || []) as unknown as VideoRow[];
    const counts = computeVideoCounts(videos);
    const liveIssues = deriveNotifications(videos).length;
    const active = videos.find((v) => v.vps_in_use);

    const events = (eventsRes.data || []) as { id: string; event_title: string | null; status: string; golden_window_hours: number | null }[];
    const unreviewed = events.filter((e) => e.status === "unprocessed" || e.status === "processing");

    const summary: WorkspaceSummary = {
      now: now.toISOString(),
      alerts: (alertsRes.data || []) as WorkspaceSummary["alerts"],
      todos: (todosRes.data || []) as WorkspaceSummary["todos"],
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
        activeJob: active ? { id: active.id, title: active.title, service: active.vps_current_service ?? null } : null,
      },
      news: {
        needsReview: unreviewed.length,
        paused: events.filter((e) => e.status === "paused").length,
        reviewed: events.filter((e) => e.status === "reviewed").length,
        urgent: unreviewed
          .filter((e) => e.golden_window_hours != null)
          .sort((a, b) => (a.golden_window_hours ?? 0) - (b.golden_window_hours ?? 0))
          .slice(0, 3)
          .map((e) => ({ id: e.id, title: e.event_title ?? "Untitled event", hours: e.golden_window_hours })),
      },
    };

    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
