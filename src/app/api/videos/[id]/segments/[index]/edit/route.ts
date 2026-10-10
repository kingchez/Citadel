import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Edits one segment's script text from the Full Script editor. Pure
 * database write - direct to Supabase.
 *
 * The edit itself is one atomic database function (edit_segment_text) that
 * only touches this one segment, so it can never overwrite a result a
 * voiceover/timing callback saved a moment earlier.
 *
 * If this segment already has a voiceover (Chatterbox already ran for it)
 * the segment is flagged `edited_pending_retry` so it keeps reminding them
 * the audio no longer matches the text until they click retry. If
 * `retry: true` is passed, the same atomic database function a retry click
 * uses (request_segment_retry) is called right after saving the text; it
 * clears the flag, marks the segment `retry` and rewinds the video.
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
    if (!Number.isInteger(segIndex)) {
      return NextResponse.json({ error: "Invalid segment index." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: edited, error: editError } = await supabase.rpc("edit_segment_text", {
      p_video_id: id,
      p_index: segIndex,
      p_text: text,
    });

    if (editError) {
      const notFound = /not found/i.test(editError.message);
      return NextResponse.json({ error: editError.message }, { status: notFound ? 404 : 500 });
    }

    const hadVoiceover = !!(edited as { hadVoiceover?: boolean } | null)?.hadVoiceover;

    if (retry && hadVoiceover) {
      const { error: retryError } = await supabase.rpc("request_segment_retry", {
        p_video_id: id,
        p_indices: [segIndex],
      });
      if (retryError) {
        return NextResponse.json(
          { error: `Text saved, but the retry could not be queued: ${retryError.message}` },
          { status: 500 }
        );
      }
    }

    const { data: video, error: fetchError } = await supabase.from("videos").select("*").eq("id", id).single();
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    return NextResponse.json({ video, hadVoiceover });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
