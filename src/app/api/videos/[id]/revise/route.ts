import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RevisionEntry } from "@/lib/types";

/**
 * Submitted from the video-output popup: Kingsley watches the finished
 * render, types what needs to change, and this appends a new entry to the
 * conversation-style `revision_history` and moves the video back to
 * `revision_requested`. Pure database write - no orchestration needed - so
 * it goes directly to Supabase. A future agent (not built yet) will pick up
 * `pending` entries, fix them, and flip them to `resolved`.
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

    const { data: existing, error: fetchError } = await supabase
      .from("videos")
      .select("revision_history")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const history: RevisionEntry[] = existing?.revision_history || [];
    const entry: RevisionEntry = {
      id: `rev_${Date.now().toString(36)}`,
      note: notes.trim(),
      status: "pending",
      created_at: new Date().toISOString(),
      resolved_at: null,
    };

    const { data, error } = await supabase
      .from("videos")
      .update({ status: "revision_requested", revision_history: [...history, entry] })
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
