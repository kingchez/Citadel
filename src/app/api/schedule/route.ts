import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseScheduleBody } from "@/lib/schedule-validate";

export const dynamic = "force-dynamic";

/**
 * GET /api/schedule?view=upcoming|history
 *  - upcoming: everything still pending (status = upcoming), soonest first.
 *  - history: finished or missed entries, newest first (last 100).
 * Reminders themselves are NOT sent from here - n8n watches this table through
 * citadel_schedule_claim_due() and pushes to the phone.
 */
export async function GET(request: NextRequest) {
  try {
    const view = request.nextUrl.searchParams.get("view") === "history" ? "history" : "upcoming";
    const supabase = getSupabaseAdmin();

    const query =
      view === "upcoming"
        ? supabase.from("citadel_schedule_items").select("*").eq("status", "upcoming").order("next_at", { ascending: true }).limit(500)
        : supabase.from("citadel_schedule_items").select("*").in("status", ["done", "missed"]).order("next_at", { ascending: false }).limit(100);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseScheduleBody(body, false);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    if (v.repeat && v.repeat !== "none" && v.repeat_until && v.starts_at && v.repeat_until < v.starts_at) {
      return NextResponse.json({ error: "Repeat-until can't be before the start." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("citadel_schedule_items")
      .insert({
        title: v.title,
        notes: v.notes ?? null,
        kind: v.kind,
        next_at: v.starts_at,
        first_at: v.starts_at,
        duration_minutes: v.duration_minutes,
        remind_before_minutes: v.remind_before_minutes,
        repeat: v.repeat,
        repeat_until: v.repeat === "none" ? null : v.repeat_until ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
