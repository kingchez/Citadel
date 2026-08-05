import { NextRequest, NextResponse } from "next/server";

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

    const n8nBaseUrl = process.env.N8N_BASE_URL;
    if (!n8nBaseUrl) {
      return NextResponse.json({ error: "N8N_BASE_URL is not configured." }, { status: 500 });
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
