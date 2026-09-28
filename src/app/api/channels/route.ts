import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Channel names for dropdowns, straight from `voices` (the same table
 * videos.channel must match). A stray row literally named "NULL" exists in
 * the table today - filtered out here so it never shows up as a choice. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("voices").select("channel").order("channel");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const channels = (data || [])
      .map((r: { channel: string | null }) => (r.channel || "").trim())
      .filter((c: string) => c && c.toUpperCase() !== "NULL");

    return NextResponse.json({ channels });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
