import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Turns a reviewed news event into a video, flagged priority. Every "get
 * next target" query in the main pipeline's dispatch lanes orders
 * priority videos first, so this jumps ahead of whatever's currently
 * queued (not yet dispatched) - it does not interrupt a job already in
 * flight, since only one job can ever hold the VPS lock regardless.
 *
 * The video starts at `planning` - Citadel doesn't write the script
 * itself, it just hands the article content over (stashed in `notes`) for
 * whatever writes the script next to pick up, tagged with where it came
 * from.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const channel: string = body?.channel || "The Daily Signal";
    const videoType: string = body?.video_type || "vertical-shorts";

    const supabase = getSupabaseAdmin();
    const { data: event, error: fetchError } = await supabase.from("events").select("*").eq("id", id).single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: fetchError.code === "PGRST116" ? 404 : 500 });
    }
    if (event.video_id) {
      return NextResponse.json({ error: "This event has already been turned into a video." }, { status: 409 });
    }

    const title = event.social_headline || event.article?.title || event.event_title || `News event #${event.id}`;

    const { data: video, error: insertError } = await supabase
      .from("videos")
      .insert({
        title,
        channel,
        status: "planning",
        video_type: videoType,
        priority: true,
        source_event_id: event.id,
        notes: {
          source: "news_pipeline",
          event_id: event.id,
          social_headline: event.social_headline,
          snapshot_summary: event.snapshot_summary,
          article: event.article,
          thumbnail: event.thumbnail,
          golden_window_hours: event.golden_window_hours,
        },
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const { error: linkError } = await supabase.from("events").update({ video_id: video.id }).eq("id", id);
    if (linkError) {
      return NextResponse.json({ error: linkError.message }, { status: 500 });
    }

    return NextResponse.json({ video });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
