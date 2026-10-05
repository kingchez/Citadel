import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveVideoSource } from "@/lib/video-source";
import { newIntroItem } from "@/lib/repurpose-sources";
import { parseTimeToSeconds } from "@/lib/repurpose-utils";

/**
 * Set (or replace) the NEW INTRO of an existing repurpose item. Unlike "add another video", this never touches
 * `sources` - the intro lives in the intro columns (new_intro_url, new_intro_original_url json, new_intro_start_seconds)
 * and intro_mode becomes "replace". The item drops back to `pending_download` so the download cron fetches it; the
 * database function refuses while a step is running or after hand-off, atomically.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const resolved = resolveVideoSource(body?.url, "Intro link");
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const start = typeof body?.start === "string" ? parseTimeToSeconds(body.start) : null;
    if (start === null) return NextResponse.json({ error: "Intro start time: use a format like 0:13 or 1:05." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("set_repurpose_intro", {
      p_id: id,
      p_intro: newIntroItem(resolved.url),
      p_start_seconds: start,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
      return NextResponse.json(
        { error: "Can't set the intro right now - this item is being processed or was handed off. Try again when it is idle." },
        { status: 409 }
      );
    }
    return NextResponse.json({ item: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
