import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Items put on hold for merging (status waiting_merge) - the only ones a scraped video can be merged into. */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("repurpose_videos")
      .select("id, title, status, video_type, sources")
      .eq("status", "waiting_merge")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const targets = (data || []).map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      video_type: r.video_type,
      source_count: Array.isArray(r.sources) ? r.sources.length : 0,
    }));
    return NextResponse.json({ targets });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
