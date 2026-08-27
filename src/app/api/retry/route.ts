import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Enqueues a single-segment/service retry into the `retries` table - the
 * dispatch cron in the Retries workflow picks it up whenever the VPS is
 * free. This is just a guarded insert (don't double-queue the same target),
 * so it goes straight to Supabase rather than through n8n's own queue
 * webhook - n8n's job starts at "interpret what's pending and dispatch it,"
 * not "receive this write on Citadel's behalf."
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { video_id, service, target } = body ?? {};

    if (!video_id || !service) {
      return NextResponse.json({ error: "Both video_id and service are required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Dedup guard: don't queue the same target twice while a retry for it
    // is still outstanding.
    let existingQuery = supabase
      .from("retries")
      .select("id")
      .eq("video_id", video_id)
      .eq("service", service)
      .in("status", ["pending", "dispatched"]);

    existingQuery = target
      ? existingQuery.eq("target", JSON.stringify(target))
      : existingQuery.is("target", null);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }
    if (existing) {
      return NextResponse.json({ retry: existing, alreadyQueued: true });
    }

    const { data, error } = await supabase
      .from("retries")
      .insert({ video_id, service, target: target ?? null, status: "pending", attempt_count: 0 })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ retry: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
