import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * "Done" - stops the repeating phone alerts for this occurrence.
 * One atomic DB function: a one-off entry becomes `done`, a repeating one rolls
 * forward to its next occurrence with the reminder state reset.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("citadel_schedule_ack", { p_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
