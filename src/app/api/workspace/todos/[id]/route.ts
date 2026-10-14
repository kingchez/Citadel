import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Tick / untick, or edit title, due time and priority. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const update: Record<string, unknown> = {};

    if (body.status === "done") {
      update.status = "done";
      update.done_at = new Date().toISOString();
    } else if (body.status === "open") {
      update.status = "open";
      update.done_at = null;
    }
    if (typeof body.title === "string") {
      const t = body.title.trim();
      if (!t) return NextResponse.json({ error: "Title can't be empty." }, { status: 400 });
      update.title = t.slice(0, 300);
    }
    if ("due_at" in body) {
      if (body.due_at === null || body.due_at === "") update.due_at = null;
      else {
        const d = new Date(String(body.due_at));
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
        update.due_at = d.toISOString();
      }
    }
    if ("priority" in body && [1, 2, 3].includes(Number(body.priority))) update.priority = Number(body.priority);
    if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("workspace_todos").update(update).eq("id", id).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "To-do not found." }, { status: 404 });
    return NextResponse.json({ todo: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("workspace_todos").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
