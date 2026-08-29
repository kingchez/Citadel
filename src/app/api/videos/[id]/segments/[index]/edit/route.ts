import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ScriptSegment } from "@/lib/types";

/**
 * Edits one segment's script text from the Full Script editor. Pure
 * database write - direct to Supabase.
 *
 * If this segment already has a voiceover (Chatterbox already ran for it)
 * and the person didn't confirm an immediate retry, the segment is flagged
 * `edited_pending_retry` so it keeps reminding them the audio no longer
 * matches the text until they click retry. If `retry: true` is passed, this
 * also queues the same guarded retry insert /api/retry uses, and the flag
 * is left unset (a successful retry rebuilds the segment without it anyway).
 * If the segment never had a voiceover yet, there's nothing to warn about.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  try {
    const { id, index } = await params;
    const segIndex = Number(index);
    const body = await request.json().catch(() => ({}));
    const text: string | undefined = body?.text;
    const retry: boolean = !!body?.retry;

    if (typeof text !== "string") {
      return NextResponse.json({ error: "text is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("script_segments")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const segments: ScriptSegment[] = video?.script_segments || [];
    const segIdx = segments.findIndex((s) => s.index === segIndex);
    if (segIdx === -1) {
      return NextResponse.json({ error: `No segment at index ${segIndex}.` }, { status: 404 });
    }

    const hadVoiceover = !!segments[segIdx].voiceover_drive_file_id;
    const updated = [...segments];
    updated[segIdx] = {
      ...updated[segIdx],
      text,
      edited_pending_retry: hadVoiceover && !retry ? true : undefined,
    };

    const { data, error } = await supabase
      .from("videos")
      .update({ script_segments: updated })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (retry && hadVoiceover) {
      const existingQuery = supabase
        .from("retries")
        .select("id")
        .eq("video_id", id)
        .eq("service", "chatterbox")
        .eq("target", JSON.stringify({ segment_index: segIndex }))
        .in("status", ["pending", "dispatched"]);
      const { data: existingRetry } = await existingQuery.maybeSingle();
      if (!existingRetry) {
        await supabase.from("retries").insert({
          video_id: id,
          service: "chatterbox",
          target: { segment_index: segIndex },
          status: "pending",
          attempt_count: 0,
        });
      }
    }

    return NextResponse.json({ video: data, hadVoiceover });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
