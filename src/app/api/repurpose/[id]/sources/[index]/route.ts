import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveVideoSource } from "@/lib/video-source";
import { newSourceItem } from "@/lib/repurpose-sources";

type Ctx = { params: Promise<{ id: string; index: string }> };

const REFUSED =
  "Can't change this video right now - the item is being processed, has reached voice timing or was handed off, or the video no longer exists. Try again when it is idle.";

function parseIndex(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n < 100 ? n : null;
}

/** Replaces the link of one video in the item. That video starts over (download/split/timing); the others keep their progress. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { id, index: rawIndex } = await params;
    const index = parseIndex(rawIndex);
    if (index === null) return NextResponse.json({ error: "Bad video number." }, { status: 400 });
    const body = await req.json().catch(() => ({}));
    const resolved = resolveVideoSource(body?.url, "Video link");
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().rpc("update_repurpose_source", { p_id: id, p_index: index, p_source: newSourceItem(resolved.url, index) });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) return NextResponse.json({ error: REFUSED }, { status: 409 });
    return NextResponse.json({ item: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Removes one video from the item and renumbers the rest. The last remaining video can't be removed. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { id, index: rawIndex } = await params;
    const index = parseIndex(rawIndex);
    if (index === null) return NextResponse.json({ error: "Bad video number." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().rpc("delete_repurpose_source", { p_id: id, p_index: index });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.id) return NextResponse.json({ error: `${REFUSED} (An item must keep at least one video.)` }, { status: 409 });
    return NextResponse.json({ item: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
