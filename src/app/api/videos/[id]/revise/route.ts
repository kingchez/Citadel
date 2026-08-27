import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Submitted from the video-output popup: Kingsley watches the finished
 * render, types what needs to change, and this downgrades the video to
 * `revision_requested` with the notes attached. Pure database write - no
 * orchestration needed - so it goes directly to Supabase rather than
 * through an n8n webhook. Picking the note up and actually fixing the
 * video is a future agent step, not built yet.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notes: string | undefined = body?.notes;

    if (!notes || !notes.trim()) {
      return NextResponse.json({ error: "Revision notes cannot be empty." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("videos")
      .update({
        status: "revision_requested",
        revision_notes: notes.trim(),
        revision_requested_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
