import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const MAX_NOTE_LENGTH = 2000;
const NOTE_KEY = /^note_[0-9]+$/;

type Ctx = { params: Promise<{ id: string; key: string }> };

/** Edits one note. Only note_N keys can be touched - subtitles and other pipeline details are never changed here. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id, key } = await params;
    if (!NOTE_KEY.test(key)) return NextResponse.json({ error: "Not a note." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "A note can't be empty. Delete it instead." }, { status: 400 });
    if (text.length > MAX_NOTE_LENGTH) return NextResponse.json({ error: `A note can be at most ${MAX_NOTE_LENGTH} characters.` }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().rpc("edit_video_note", { p_id: id, p_key: key, p_text: text });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.all_notes) return NextResponse.json({ error: "That note no longer exists. Refresh the page." }, { status: 404 });
    return NextResponse.json({ notes: row.all_notes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Deletes one note. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, key } = await params;
    if (!NOTE_KEY.test(key)) return NextResponse.json({ error: "Not a note." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().rpc("delete_video_note", { p_id: id, p_key: key });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.all_notes) return NextResponse.json({ error: "That note no longer exists. Refresh the page." }, { status: 404 });
    return NextResponse.json({ notes: row.all_notes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
