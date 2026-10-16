import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveVideoSource } from "@/lib/video-source";
import { newSourceItem } from "@/lib/repurpose-sources";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Merges a scraped video into an existing repurpose item, then removes it from the review pool.
 * `target` is either the repurpose item's id or its linked video's id (the id shown on the video page).
 * The actual merge is the existing add_repurpose_source() database function - it appends the video, drops the
 * item back to pending_download so only the new video is processed, and refuses items that are mid-run or handed off.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const target = typeof body?.target === "string" ? body.target.trim() : "";
    if (!UUID_RE.test(target)) return NextResponse.json({ error: "Pick an item or paste a valid ID." }, { status: 400 });

    const supabase = getSupabaseAdmin();

    const pooled = await supabase.from("repurpose_scraped_videos").select("id, video_url").eq("id", id).maybeSingle();
    if (pooled.error) return NextResponse.json({ error: pooled.error.message }, { status: 500 });
    if (!pooled.data) {
      return NextResponse.json({ error: "That video is no longer in the review pool (it was already added or removed). Refresh the list." }, { status: 409 });
    }

    const resolved = resolveVideoSource(typeof body?.url === "string" && body.url.trim() ? body.url : pooled.data.video_url, "Video link");
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

    // The pasted ID may be the repurpose item's id or its linked video's id.
    let item = (await supabase.from("repurpose_videos").select("id, video_id, title").eq("id", target).maybeSingle()).data;
    if (!item) item = (await supabase.from("repurpose_videos").select("id, video_id, title").eq("video_id", target).maybeSingle()).data;
    if (!item) return NextResponse.json({ error: "No repurpose item found with that ID." }, { status: 404 });

    const { data, error } = await supabase.rpc("add_repurpose_source", { p_id: item.id, p_source: newSourceItem(resolved.url) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
      return NextResponse.json(
        { error: "Can't merge into that item right now - it is being processed, was handed off, or already has the maximum number of videos." },
        { status: 409 }
      );
    }

    // Merged - everything below is reported as a warning, never as a failure.
    const warnings: string[] = [];
    if (body?.priority === true && item.video_id) {
      const { error: prioError } = await supabase.from("videos").update({ priority: true }).eq("id", item.video_id);
      if (prioError) warnings.push(`It was merged, but the item couldn't be marked priority: ${prioError.message}`);
    }
    const { error: delError } = await supabase.from("repurpose_scraped_videos").delete().eq("id", id);
    if (delError) warnings.push(`It was merged, but couldn't be removed from the review pool: ${delError.message}`);

    return NextResponse.json({ item: { id: row.id, title: item.title, total_sources: row.total_sources }, warnings });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
