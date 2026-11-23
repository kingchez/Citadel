import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: current, error: readErr } = await supabase
      .from("articles")
      .select("status")
      .eq("id", id)
      .single();

    if (readErr || !current) {
      return NextResponse.json({ error: readErr?.message || "Article not found" }, { status: 404 });
    }

    // Stage 1 approval (review_ready) -> canva_ready; Stage 2 approval (final_review) -> approved
    const nextStatus = current.status === "final_review" ? "approved" : "canva_ready";

    const { data, error } = await supabase
      .from("articles")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, article: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}