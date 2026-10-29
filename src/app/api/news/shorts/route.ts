import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Canva news shorts, newest first, with the title of the event each one belongs to. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("news_shorts")
      .select("*, events(event_title)")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shorts: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
