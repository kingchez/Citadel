import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { deriveNotifications, type NotificationSourceVideo } from "@/lib/notifications";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("videos")
      .select("id, title, status, error_details, script_segments, voice_timing, media_assets, updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notifications = deriveNotifications((data || []) as NotificationSourceVideo[]);
    return NextResponse.json({ notifications });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
