import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Trends waiting for human review after passing AI Event Normalizer and
 * duplicate check in n8n. Includes the linked event record (event_title,
 * fingerprint, snapshot_summary, global_relevance_score, confidence, batch_id). */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("Trend_Processing")
      .select("*, events:events_id(id, event_title, fingerprint, snapshot_summary, global_relevance_score, confidence, batch_id)")
      .eq("status", "needs_review")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trends: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
