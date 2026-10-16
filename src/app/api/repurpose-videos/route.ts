import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Reorders a batch so two videos from the same channel never sit side by side (unless only one channel is left). */
function spreadChannels<T extends { source_channel_id: string }>(list: T[]): T[] {
  const rest = [...list];
  const out: T[] = [];
  while (rest.length > 0) {
    const last = out[out.length - 1]?.source_channel_id;
    const i = rest.findIndex((v) => v.source_channel_id !== last);
    out.push(rest.splice(i === -1 ? 0 : i, 1)[0]);
  }
  return out;
}

/**
 * A random batch of scraped videos to review. The database function spreads channels apart (each channel's
 * videos get a random rank and the batch is ordered by it), so consecutive videos come from different channels.
 * `total` is the size of the whole pool, not just this batch.
 */
export async function GET(request: NextRequest) {
  try {
    const limitParam = Number(request.nextUrl.searchParams.get("limit"));
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 50) : 20;

    const supabase = getSupabaseAdmin();
    const [batch, total] = await Promise.all([
      supabase.rpc("repurpose_random_scraped_videos", { p_limit: limit }),
      supabase.from("repurpose_scraped_videos").select("id", { count: "exact", head: true }),
    ]);
    if (batch.error) return NextResponse.json({ error: batch.error.message }, { status: 500 });
    if (total.error) return NextResponse.json({ error: total.error.message }, { status: 500 });

    return NextResponse.json({ videos: spreadChannels(batch.data || []), total: total.count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
