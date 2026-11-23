import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  deriveNotifications,
  deriveTrendExpiryNotifications,
  mergeAndDedupeNotifications,
  type NotificationSourceTrend,
  type NotificationSourceVideo,
  type WorkspaceNotificationRow,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [videosRes, alertsRes, trendsRes] = await Promise.all([
      supabase
        .from("videos")
        .select("id, title, status, error_details, script_segments, voice_timing, media_assets, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("workspace_notifications")
        .select("*")
        .eq("status", "open")
        .order("last_seen_at", { ascending: false })
        .limit(60),
      supabase
        .from("Trend_Processing")
        .select("id, trending_keyword, status, usableVideos, created_at")
        .eq("status", "needs_review"),
    ]);

    if (videosRes.error) {
      return NextResponse.json({ error: videosRes.error.message }, { status: 500 });
    }
    if (alertsRes.error) {
      return NextResponse.json({ error: alertsRes.error.message }, { status: 500 });
    }

    const openAlerts = (alertsRes.data || []) as WorkspaceNotificationRow[];
    const trendExpiryAlerts = trendsRes.error
      ? []
      : deriveTrendExpiryNotifications((trendsRes.data || []) as NotificationSourceTrend[]);

    // Sync trend expiry alerts into workspace_notifications so mobile/table
    // consumers see them, and auto-resolve once the trend leaves needs_review.
    const activeKeys = new Set(trendExpiryAlerts.map((a) => a.dedupe_key));
    const existingByKey = new Map(
      openAlerts
        .filter((a) => a.dedupe_key.startsWith("trend-expiry:"))
        .map((a) => [a.dedupe_key, a])
    );

    const staleIds = openAlerts
      .filter((a) => a.dedupe_key.startsWith("trend-expiry:") && !activeKeys.has(a.dedupe_key))
      .map((a) => a.id);

    const syncTasks: Promise<unknown>[] = [];

    if (staleIds.length > 0) {
      syncTasks.push(
        Promise.resolve(
          supabase
            .from("workspace_notifications")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolved_via: "auto",
            })
            .in("id", staleIds)
        )
      );
    }

    for (const alert of trendExpiryAlerts) {
      const existing = existingByKey.get(alert.dedupe_key);
      const stateChanged =
        !existing ||
        (alert.title.startsWith("Video URL expired") && !existing.title.startsWith("Video URL expired"));
      if (stateChanged) {
        syncTasks.push(
          Promise.resolve(
            supabase.rpc("ws_notification_log", {
              p_key: alert.dedupe_key,
              p_source: "News Trend Review",
              p_ref: String(alert.trend_id),
              p_severity: "warning",
              p_title: alert.title,
              p_details: alert.summary,
              p_link: "/news/review",
            })
          )
        );
      }
    }

    if (syncTasks.length > 0) {
      await Promise.allSettled(syncTasks);
    }

    const staleIdSet = new Set(staleIds);
    const activeWorkspaceAlerts = openAlerts.filter((a) => !staleIdSet.has(a.id));

    const videoNotifications = deriveNotifications((videosRes.data || []) as NotificationSourceVideo[]);
    const notifications = mergeAndDedupeNotifications(
      [...videoNotifications, ...trendExpiryAlerts],
      activeWorkspaceAlerts
    );
    return NextResponse.json({ notifications });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
