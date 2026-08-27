import { NextRequest, NextResponse } from "next/server";
import { getN8nBaseUrl } from "@/lib/n8n";

/**
 * Submitted from the video-output popup: Kingsley watches the finished
 * render, types what needs to change, and this downgrades the video to
 * `revision_requested` with the notes attached. This calls the same generic
 * `update-video` webhook every other part of the pipeline already uses -
 * no dedicated n8n workflow needed for the write itself. Picking the note
 * up and actually fixing the video is a future agent step, not built yet.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const notes: string | undefined = body?.notes;

    if (!notes || !notes.trim()) {
      return NextResponse.json({ error: "Revision notes cannot be empty." }, { status: 400 });
    }

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    const res = await fetch(`${n8nBaseUrl}/webhook/update-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        video_id: id,
        status: "revision_requested",
        revision_notes: notes.trim(),
        revision_requested_at: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Pipeline rejected the revision request: ${text}` }, { status: 502 });
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
