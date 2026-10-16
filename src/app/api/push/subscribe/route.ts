import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Remember this phone/browser so alerts can be pushed to it. Safe to call repeatedly (upsert). */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
    };
    const sub = body.subscription;
    const endpoint = sub?.endpoint;
    const p256dh = sub?.keys?.p256dh;
    const auth = sub?.keys?.auth;
    if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint) || endpoint.length > 2048 || typeof p256dh !== "string" || typeof auth !== "string") {
      return NextResponse.json({ error: "That doesn't look like a valid push subscription." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ endpoint, p256dh, auth, user_agent: (request.headers.get("user-agent") || "").slice(0, 300) }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
