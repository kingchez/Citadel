import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Trends waiting for the first review (articles, images and videos are
 * already extracted by n8n). Biggest traffic first isn't reliable because
 * traffic is text like "200+", so newest first. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("Trend_Processing")
      .select("*")
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
