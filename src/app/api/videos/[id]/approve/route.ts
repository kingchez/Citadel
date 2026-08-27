import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// One-click approve only ever means "move to the next state," never a
// per-segment action - matches the pipeline's "single click for the whole
// review step" design. Only these three transitions are ever valid; approving
// from any other status is refused rather than guessed.
//
// This is a pure status write with no orchestration behind it, so it goes
// straight to Supabase - n8n's job is to watch the database and decide what
// to do next based on state, not to be a passthrough for writes Citadel can
// make itself.
const NEXT_STATUS: Record<string, string> = {
  media_review: "media_ready",
  production_review: "done",
  done: "shipped",
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const currentStatus: string | undefined = body?.current_status;

    if (!currentStatus || !(currentStatus in NEXT_STATUS)) {
      return NextResponse.json(
        {
          error: `"${currentStatus}" isn't an approvable checkpoint. Expected one of: ${Object.keys(
            NEXT_STATUS
          ).join(", ")}.`,
        },
        { status: 400 }
      );
    }

    const nextStatus = NEXT_STATUS[currentStatus];
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("videos")
      .update({ status: nextStatus })
      .eq("id", id)
      .eq("status", currentStatus) // guards against a stale client racing a status change that already happened elsewhere
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Video status changed elsewhere before this approval went through. Refresh and try again." },
        { status: 409 }
      );
    }

    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
