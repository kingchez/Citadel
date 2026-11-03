import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cleanTemplateInput, makeTemplateKey } from "@/lib/news-templates";

/** Every template (video and social) plus the category choices for the form dropdown. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [templates, categories] = await Promise.all([
      supabase.from("canva_templates").select("*").order("purpose").order("role").order("label"),
      supabase.from("categories").select("name"),
    ]);

    if (templates.error) {
      return NextResponse.json({ error: templates.error.message }, { status: 500 });
    }

    // "All" first, then the pipeline's categories, then any category already used on a template
    const names = new Set<string>();
    for (const c of categories.data || []) if (c.name) names.add(c.name as string);
    for (const t of templates.data || []) if (t.category && t.category !== "All") names.add(t.category as string);

    return NextResponse.json({
      templates: templates.data,
      categories: ["All", ...Array.from(names).sort((a, b) => a.localeCompare(b))],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = cleanTemplateInput(body);
    if (typeof input === "string") {
      return NextResponse.json({ error: input }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("canva_templates")
      .insert({ key: makeTemplateKey(input.label), ...input })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
