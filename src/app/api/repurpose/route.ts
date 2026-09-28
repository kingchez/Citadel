import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Lists repurpose items, newest first. Read-only; creation goes through
 * /api/pipeline/insert alongside the "new video" path. */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status");
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("repurpose_videos")
      .select(
        "id, title, channel, video_type, status, source_video_url, source_video_file_id, intro_mode, new_intro_url, new_intro_file_id, new_intro_start_seconds, with_product, product_ids, video_only_drive_file_id, audio_drive_file_id, error_details, video_id, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ items: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
