import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseYoutubeChannelInput } from "@/lib/repurpose-channels";

/** Channels King scouts repurpose videos from, each with how many of its videos are waiting for review. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [channels, pool] = await Promise.all([
      supabase
        .from("repurpose_source_channels")
        .select("id, platform, channel_username, channel_id, channel_name, avatar_url, status, error_details, last_checked_at, created_at, product_sites")
        .order("created_at", { ascending: false }),
      supabase.from("repurpose_scraped_videos").select("source_channel_id").range(0, 9999),
    ]);
    if (channels.error) return NextResponse.json({ error: channels.error.message }, { status: 500 });
    if (pool.error) return NextResponse.json({ error: pool.error.message }, { status: 500 });

    const counts = new Map<string, number>();
    for (const r of pool.data || []) counts.set(r.source_channel_id, (counts.get(r.source_channel_id) || 0) + 1);

    return NextResponse.json({ channels: (channels.data || []).map((c) => ({ ...c, video_count: counts.get(c.id) || 0 })) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Adds a channel as `pending` - the n8n scrape workflow picks it up, fills in its name/avatar and its latest videos. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.platform !== "youtube") {
      return NextResponse.json({ error: body?.platform === "tiktok" ? "TikTok isn't connected yet." : "platform must be 'youtube'." }, { status: 400 });
    }
    const parsed = parseYoutubeChannelInput(body?.input);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("repurpose_source_channels")
      .insert({ platform: "youtube", channel_username: parsed.channel_username, channel_id: parsed.channel_id, status: "pending" })
      .select("id, platform, channel_username, channel_id, status")
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That channel is already added." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ channel: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
