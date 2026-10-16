import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Removes a channel and every video of it still waiting in the review pool (cascade). Those unreviewed videos
 * are also forgotten by the "seen" ledger, so re-adding the channel later brings them back.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const pooled = await supabase.from("repurpose_scraped_videos").select("platform, video_id").eq("source_channel_id", id);
    if (pooled.error) return NextResponse.json({ error: pooled.error.message }, { status: 500 });
    for (const v of pooled.data || []) {
      const { error } = await supabase.from("repurpose_seen_videos").delete().eq("platform", v.platform).eq("video_id", v.video_id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error } = await supabase.from("repurpose_source_channels").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
