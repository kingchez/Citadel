import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { OPTION_DEFS, isOptionKey } from "@/lib/video-options";

/** Sets one video option (subtitles / change script / listing direction). value null = "decide later". */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const key = typeof body?.key === "string" ? body.key : "";
    if (!isOptionKey(key)) return NextResponse.json({ error: "Unknown option." }, { status: 400 });

    const value = body?.value === null ? null : typeof body?.value === "string" ? body.value : undefined;
    const def = OPTION_DEFS.find((d) => d.key === key)!;
    if (value === undefined || (value !== null && !def.values.includes(value))) {
      return NextResponse.json({ error: `${def.label} must be one of: ${def.values.join(", ")} (or decide later).` }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin().rpc("set_video_option", { p_id: id, p_key: key, p_value: value });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    return NextResponse.json({ notes: row.all_notes });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
