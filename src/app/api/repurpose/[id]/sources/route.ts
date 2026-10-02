import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveVideoSource } from "@/lib/video-source";
import { newSourceItem } from "@/lib/repurpose-sources";

/**
 * Add ONE more video to an existing repurpose item. The whole item drops back
 * to `pending_download`; the workflows then only do the new video (finished
 * videos keep their results). Refused while a step is running, and after
 * hand-off - the database function decides, atomically.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const resolved = resolveVideoSource(body?.url, "Video link");
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("add_repurpose_source", { p_id: id, p_source: newSourceItem(resolved.url) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) {
      return NextResponse.json(
        { error: "Can't add a video right now - this item is being processed, was handed off, or already has the maximum number of videos. Try again when it is idle." },
        { status: 409 }
      );
    }
    return NextResponse.json({ item: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
