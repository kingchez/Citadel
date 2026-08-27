import { NextRequest, NextResponse } from "next/server";
import { getN8nBaseUrl } from "@/lib/n8n";

/**
 * Bulk "I didn't like this take" redo for one or more Chatterbox segments.
 * Deliberately separate from /api/retry: this bypasses the retries table
 * entirely (no attempt_count, no exhaustion, no alerts) via its own webhook
 * and dispatch lane in the Retries workflow. Empty segment_indices means
 * "redo every segment."
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const segmentIndices: number[] = Array.isArray(body?.segment_indices) ? body.segment_indices : [];

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    const res = await fetch(`${n8nBaseUrl}/webhook/citadel-redo-chatterbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: id, segment_indices: segmentIndices }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Could not queue Citadel redo: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true, segment_indices: segmentIndices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
