import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Sends a test notification to every subscribed phone, through the same path real alerts use. */
export async function POST() {
  try {
    const supabase = getSupabaseAdmin();
    const { count, error: countError } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true });
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if (!count) return NextResponse.json({ error: "No phone is subscribed yet. Tap Enable notifications first." }, { status: 400 });

    const { error } = await supabase.rpc("push_send", {
      p_title: "Citadel test",
      p_body: "Phone alerts are working. 🎉",
      p_url: "/",
      p_tag: "citadel-test",
      p_urgency: "high",
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, devices: count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
