import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * One retry click, for any service. All the bookkeeping happens inside a
 * single database function so a click is atomic:
 *  - chatterbox / whisperx -> request_segment_retry: marks that segment
 *    `retry`, drops its voice timing, registers the old voiceover (and old
 *    render) in media_to_delete, and rewinds the whole video to
 *    `script_written` - even if a job on it is currently running.
 *  - render -> request_render_retry: old render registered for deletion, video
 *    back to `final_scene_planned`.
 *  - autobrowse -> request_media_retry: old file registered, that media entry
 *    reset to `pending`.
 * Main's own crons then pick the work up; there is no retries table anymore.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { video_id, service, target } = body ?? {};

    if (!video_id || !service) {
      return NextResponse.json({ error: "Both video_id and service are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let result;

    if (service === "chatterbox" || service === "whisperx") {
      const idx = service === "chatterbox" ? target?.segment_index : target?.clip_index;
      if (typeof idx !== "number") {
        return NextResponse.json({ error: `A ${service} retry needs a segment index.` }, { status: 400 });
      }
      result = await supabase.rpc("request_segment_retry", { p_video_id: video_id, p_indices: [idx] });
    } else if (service === "render") {
      result = await supabase.rpc("request_render_retry", { p_video_id: video_id });
    } else if (service === "autobrowse") {
      if (typeof target?.code !== "string") {
        return NextResponse.json({ error: "A media retry needs the media code." }, { status: 400 });
      }
      result = await supabase.rpc("request_media_retry", { p_video_id: video_id, p_code: target.code });
    } else {
      return NextResponse.json({ error: `Unknown service "${service}".` }, { status: 400 });
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: result.data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
