import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ error: "Give the to-do a title." }, { status: 400 });
    if (title.length > 300) return NextResponse.json({ error: "Title is too long (max 300)." }, { status: 400 });

    let due_at: string | null = null;
    if (typeof body.due_at === "string" && body.due_at) {
      const d = new Date(body.due_at);
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
      due_at = d.toISOString();
    }
    const priority = [1, 2, 3].includes(Number(body.priority)) ? Number(body.priority) : 2;
    const project = typeof body.project === "string" && body.project.trim() ? body.project.trim().slice(0, 60) : null;
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 2000) : null;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("workspace_todos").insert({ title, due_at, priority, project, notes }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ todo: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
