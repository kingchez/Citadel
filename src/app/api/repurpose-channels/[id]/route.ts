import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseSiteLinks } from "@/lib/repurpose-channels";

/** Removes a channel and every video of it still waiting in the review pool (cascade). Videos already queued for repurpose are untouched. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from("repurpose_source_channels").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Saves the channel's product website link(s) (jsonb array on the channel row). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = parseSiteLinks(body?.product_sites);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("repurpose_source_channels").update({ product_sites: parsed.sites }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ product_sites: parsed.sites });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
