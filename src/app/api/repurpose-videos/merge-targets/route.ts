import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Statuses add_repurpose_source() accepts - anything else (running, handed off, cancelled) can't take another video. */
const MERGEABLE_STATUSES = [
  "pending_download",
  "download_error",
  "pending_split",
  "split_error",
  "split_done",
  "voice_timing_error",
  "voice_timing_done",
];

/** Recent repurpose items a scraped video can be merged into. */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("repurpose_videos")
      .select("id, title, status, video_type, sources")
      .in("status", MERGEABLE_STATUSES)
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
