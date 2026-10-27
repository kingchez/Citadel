import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProductEntry } from "@/lib/types";
import { isClipJob } from "@/lib/repurpose-utils";

/** Repurpose items that are at (or past) the product step, newest first, for the Products page. Read-only. */
export async function GET() {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("repurpose_videos")
      .select(
        "id, title, channel, status, notes, products_step, sources, video_id, created_at, updated_at, video:videos!repurpose_videos_video_id_fkey(product_ids, Products_Processing_Status)"
      )
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(150);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data ?? [])
      .filter((r) => isClipJob(r.notes) || (r.channel === "Viral Shop" && (r.status === "voice_timing_done" || r.status === "handed_off")))
      .slice(0, 60)
      .map((r) => {
        const video = (Array.isArray(r.video) ? r.video[0] : r.video) as { product_ids: ProductEntry[] | null; Products_Processing_Status: string | null } | null;
        const products = Array.isArray(video?.product_ids) ? video!.product_ids! : [];
        return {
          id: r.id,
          title: r.title,
          channel: r.channel,
          kind: isClipJob(r.notes) ? "clip_job" : "repurpose",
          status: r.status,
          products_step: r.products_step,
          source_count: Array.isArray(r.sources) ? r.sources.length : 0,
          created_at: r.created_at,
          updated_at: r.updated_at,
          shop_status: video?.Products_Processing_Status ?? null,
          products,
        };
      });
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
