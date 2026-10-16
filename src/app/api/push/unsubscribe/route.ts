import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
    if (typeof body.endpoint !== "string") return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
