import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Every reviewable event, most time-sensitive first (soonest-expiring
 * golden_window_hours), then most relevant. Filtering by status happens
 * client-side (same pattern as /api/videos) since the whole list is small. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("events")
      .select(
        "id, event_title, snapshot_summary, global_relevance_score, confidence, created_at, article, usablethumbnails, usablevideos, social_headline, alt_thumbnail, thumbnail, status, category_reference, wordpress_posted, is_reviewed, golden_window_hours, video_id"
      )
      .order("golden_window_hours", { ascending: true, nullsFirst: false })
      .order("global_relevance_score", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ events: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
