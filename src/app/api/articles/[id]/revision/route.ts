import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ArticleRevisionEntry } from "@/lib/article-types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { note } = await request.json();

    if (!note || typeof note !== "string" || !note.trim()) {
      return NextResponse.json({ error: "Revision note is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Fetch existing revision history
    const { data: current, error: fetchErr } = await supabase
      .from("articles")
      .select("revision_history")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: fetchErr?.message || "Article not found" }, { status: 404 });
    }

    const newEntry: ArticleRevisionEntry = {
      id: crypto.randomUUID(),
      note: note.trim(),
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const updatedHistory = [...(current.revision_history || []), newEntry];

    const { data, error } = await supabase
      .from("articles")
      .update({
        status: "revision_requested",
        revision_history: updatedHistory,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, article: data, entry: newEntry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
