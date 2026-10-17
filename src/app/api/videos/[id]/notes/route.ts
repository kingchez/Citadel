import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_NOTE_LENGTH = 2000;

/** Adds a note to a video (the next note_N in videos.notes). Existing notes and other keys are never touched. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "Write the note first." }, { status: 400 });
    if (text.length > MAX_NOTE_LENGTH) return NextResponse.json({ error: `A note can be at most ${MAX_NOTE_LENGTH} characters.` }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().rpc("add_video_note", { p_id: id, p_text: text });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.note_key) return NextResponse.json({ error: "Video not found." }, { status: 404 });

    return NextResponse.json({ key: row.note_key, notes: row.all_notes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
