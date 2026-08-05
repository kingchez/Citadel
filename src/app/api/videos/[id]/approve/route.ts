import { NextRequest, NextResponse } from "next/server";
import { getN8nBaseUrl } from "@/lib/n8n";

// One-click approve only ever means "move to the next state," never a
// per-segment action - matches the pipeline's "single click for the whole
// review step" design. Only these three transitions are ever valid; approving
// from any other status is refused rather than guessed.
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

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    const nextStatus = NEXT_STATUS[currentStatus];

    const res = await fetch(`${n8nBaseUrl}/webhook/update-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: id, status: nextStatus }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Pipeline rejected the approval: ${text}` },
        { status: 502 }
      );
    }

    const updated = await res.json();
    return NextResponse.json({ video: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
