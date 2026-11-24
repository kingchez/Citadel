import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cleanTemplateInput, makeTemplateKey } from "@/lib/news-templates";

/** Every template (video and social) plus the channel choices for the form. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [templates, voices] = await Promise.all([
      supabase.from("canva_templates").select("*").order("purpose").order("role").order("label"),
      supabase.from("voices").select("channel").order("channel"),
    ]);

    if (templates.error) {
      return NextResponse.json({ error: templates.error.message }, { status: 500 });
    }

    // "All" and "News" first, then the pipeline's channels, then any channel already used on a template
    const names = new Set<string>(["News"]);
    for (const v of voices.data || []) {
      const ch = typeof v.channel === "string" ? v.channel.trim() : "";
      if (ch && ch.toUpperCase() !== "NULL" && ch !== "All") names.add(ch);
    }
    for (const t of templates.data || []) {
      const chs = Array.isArray(t.channel) ? t.channel : typeof t.channel === "string" ? [t.channel] : [];
      for (const ch of chs) {
        if (typeof ch === "string" && ch.trim() && ch.trim() !== "All") {
          names.add(ch.trim());
        }
      }
    }

    const sorted = Array.from(names).sort((a, b) => {
      if (a === "News") return -1;
      if (b === "News") return 1;
      return a.localeCompare(b);
    });
    const channels = ["All", ...sorted];

    return NextResponse.json({
      templates: templates.data,
      channels,
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
