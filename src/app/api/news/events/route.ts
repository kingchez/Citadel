import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Every reviewable event (excluding skeleton "pending" events still waiting
 * in Trend Review), most time-sensitive first (soonest-expiring
 * golden_window_hours), then most relevant. Also returns news_highlight_reels
 * status records so the All Events page can show Ready / Processing states. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [eventsRes, reelsRes] = await Promise.all([
      supabase
        .from("events")
        .select(
          "id, event_title, snapshot_summary, global_relevance_score, confidence, created_at, article, usablethumbnails, usablevideos, social_headline, alt_thumbnail, thumbnail, status, category_reference, wordpress_posted, is_reviewed, golden_window_hours, video_id, post_format, selected_media, selected_thumbnails, voiceover, batch_id, Thumbnail_GDrive_Url, Thumbnail_GDrive_Id, preferred_templates, canva_template_key, canva_design_version"
        )
        .neq("status", "pending")
        .order("golden_window_hours", { ascending: true, nullsFirst: false })
        .order("global_relevance_score", { ascending: false }),
      supabase
        .from("news_highlight_reels")
        .select("batch_id, status, drive_file_id, drive_url, error_message, updated_at"),
    ]);

    if (eventsRes.error) {
      return NextResponse.json({ error: eventsRes.error.message }, { status: 500 });
    }

    return NextResponse.json({
      events: eventsRes.data,
      highlightReels: reelsRes.data || [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
