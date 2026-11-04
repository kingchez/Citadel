import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cleanTemplateInput } from "@/lib/news-templates";

/** Saves edits to a template. Body {action: "reset_usage"} puts its use count back to zero. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    if (body.action === "reset_usage") {
      const { data, error } = await supabase
        .from("canva_templates")
        .update({ usage_count: 0, last_used_at: null })
        .eq("key", key)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
      return NextResponse.json({ template: data });
    }

    const input = cleanTemplateInput(body);
    if (typeof input === "string") {
      return NextResponse.json({ error: input }, { status: 400 });
    }

    const { data, error } = await supabase.from("canva_templates").update(input).eq("key", key).select().single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
    }
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("canva_templates").delete().eq("key", key);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
