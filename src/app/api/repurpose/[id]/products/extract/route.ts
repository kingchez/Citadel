import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** "Find products again": clears the step so the n8n extraction workflow reads the transcript again. Products already
 * saved on the video are kept; the new proposals only show up beside them. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("repurpose_videos")
      .update({ products_step: null, products_step_at: null, product_candidates: null })
      .eq("id", id)
      .eq("status", "voice_timing_done")
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Only an item at \"voice timing done\" can search again." }, { status: 409 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
