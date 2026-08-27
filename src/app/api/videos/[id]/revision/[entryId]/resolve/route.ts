import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { RevisionEntry } from "@/lib/types";

/**
 * Marks one revision entry resolved. This is what the future fixing-agent
 * will call once it's actually built; for now it's exposed as a manual
 * button in Citadel so the conversation flow can be tested end-to-end.
 * When the last pending entry clears, the video moves back to
 * `production_review` so Kingsley re-watches it.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  try {
    const { id, entryId } = await params;

    const supabase = getSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("revision_history, status")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const history: RevisionEntry[] = video?.revision_history || [];
    const idx = history.findIndex((e) => e.id === entryId);
    if (idx === -1) {
      return NextResponse.json({ error: "Revision entry not found." }, { status: 404 });
    }

    const updatedHistory = [...history];
    updatedHistory[idx] = { ...updatedHistory[idx], status: "resolved", resolved_at: new Date().toISOString() };

    const stillPending = updatedHistory.some((e) => e.status === "pending");
    const nextStatus = !stillPending && video?.status === "revision_requested" ? "production_review" : video?.status;

    const { data, error } = await supabase
      .from("videos")
      .update({ revision_history: updatedHistory, status: nextStatus })
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
