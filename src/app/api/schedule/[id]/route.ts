import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseScheduleBody } from "@/lib/schedule-validate";

export const dynamic = "force-dynamic";

/** Edit an entry. Changing the start time re-arms it: the reminder state resets and it is upcoming again. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = parseScheduleBody(body, true);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const v = parsed.value;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (v.title !== undefined) update.title = v.title;
    if (v.notes !== undefined) update.notes = v.notes;
    if (v.kind !== undefined) update.kind = v.kind;
    if (v.duration_minutes !== undefined) update.duration_minutes = v.duration_minutes;
    if (v.remind_before_minutes !== undefined) update.remind_before_minutes = v.remind_before_minutes;
    if (v.repeat !== undefined) {
      update.repeat = v.repeat;
      if (v.repeat === "none") update.repeat_until = null;
    }
    if (v.repeat_until !== undefined && v.repeat !== "none") update.repeat_until = v.repeat_until;
    if (v.active !== undefined) update.active = v.active;
    if (v.starts_at !== undefined) {
      update.next_at = v.starts_at;
      update.first_at = v.starts_at;
      update.status = "upcoming";
      update.acknowledged_at = null;
      update.last_notified_at = null;
      update.notify_count = 0;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("citadel_schedule_items").update(update).eq("id", id).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("citadel_schedule_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
