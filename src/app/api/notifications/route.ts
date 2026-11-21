import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  deriveNotifications,
  mergeAndDedupeNotifications,
  type NotificationSourceVideo,
  type WorkspaceNotificationRow,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [videosRes, alertsRes] = await Promise.all([
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
    ]);

    if (videosRes.error) {
      return NextResponse.json({ error: videosRes.error.message }, { status: 500 });
    }
    if (alertsRes.error) {
      return NextResponse.json({ error: alertsRes.error.message }, { status: 500 });
    }

    const videoNotifications = deriveNotifications((videosRes.data || []) as NotificationSourceVideo[]);
    const notifications = mergeAndDedupeNotifications(
      videoNotifications,
      (alertsRes.data || []) as WorkspaceNotificationRow[]
    );
    return NextResponse.json({ notifications });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
