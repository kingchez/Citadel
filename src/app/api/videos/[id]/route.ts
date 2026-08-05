import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("*")
      .eq("id", id)
      .single();

    if (videoError) {
      return NextResponse.json({ error: videoError.message }, { status: 404 });
    }

    // Retries and inspections tied to this video are shown alongside it so
    // the person can see everything about this video in one place, without
    // needing to know these live in separate tables under the hood.
    const { data: retries } = await supabase
      .from("retries")
      .select("*")
      .eq("video_id", id)
      .order("created_at", { ascending: false });

    const { data: inspections } = await supabase
      .from("inspections")
      .select("*")
      .eq("video_id", id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ video, retries: retries ?? [], inspections: inspections ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
