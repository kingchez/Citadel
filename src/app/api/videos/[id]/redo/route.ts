import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Redo one, several, or every segment's voiceover. Same atomic database
 * function as a single retry click (request_segment_retry): the chosen
 * segments are marked `retry`, their old voiceover files (and the old render,
 * if any) are registered in media_to_delete, their voice timing is dropped,
 * and the whole video drops back to `script_written`. Empty segment_indices
 * means "redo every segment".
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const segmentIndices: number[] = Array.isArray(body?.segment_indices) ? body.segment_indices : [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("request_segment_retry", {
      p_video_id: id,
      p_indices: segmentIndices.length ? segmentIndices : null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ result: data, segment_indices: segmentIndices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
