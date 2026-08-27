import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Bulk "I didn't like this take" redo for one or more Chatterbox segments.
 * This just stamps `videos.active_retry` - the Citadel Manual Redo dispatch
 * cron in the Retries workflow watches that field and does the actual work
 * (delete old files, resend to Chatterbox) whenever the VPS is free. Citadel
 * writes the queue entry directly; n8n's job starts at "notice active_retry
 * is set and act on it," not "receive the write on Citadel's behalf."
 * Deliberately separate from /api/retry: this bypasses the retries table
 * entirely (no attempt_count, no exhaustion, no alerts). Empty
 * segment_indices means "redo every segment."
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const segmentIndices: number[] = Array.isArray(body?.segment_indices) ? body.segment_indices : [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("videos")
      .update({
        active_retry: {
          source: "citadel_manual",
          segment_indices: segmentIndices,
          requested_at: new Date().toISOString(),
        },
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data, segment_indices: segmentIndices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
