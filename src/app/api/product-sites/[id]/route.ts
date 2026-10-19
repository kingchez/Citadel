import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { assertPublicHttpUrl } from "@/lib/product-sites";

/** Edit a site: label, on/off, channel, mode, selector, pages pattern, link. Changing the link, mode, selector or pattern needs a re-read (the client calls sync after). */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (typeof body?.label === "string" && body.label.trim()) updates.label = body.label.trim().slice(0, 80);
    if (typeof body?.enabled === "boolean") updates.enabled = body.enabled;
    if (body?.mode === "html" || body?.mode === "json") updates.mode = body.mode;
    if ("source_channel_id" in (body ?? {})) updates.source_channel_id = typeof body.source_channel_id === "string" && body.source_channel_id ? body.source_channel_id : null;
    if ("item_selector" in (body ?? {})) updates.item_selector = typeof body.item_selector === "string" && body.item_selector.trim() ? body.item_selector.trim() : null;
    if ("page_pattern" in (body ?? {})) {
      const p = typeof body.page_pattern === "string" ? body.page_pattern.trim() : "";
      if (p && !p.includes("{n}")) return NextResponse.json({ error: "The pages pattern must contain {n}." }, { status: 400 });
      updates.page_pattern = p || null;
    }
    if (typeof body?.url === "string") {
      try {
        updates.url = assertPublicHttpUrl(body.url.trim()).toString();
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid link." }, { status: 400 });
      }
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin()
      .from("product_sites")
      .update(updates)
      .eq("id", id)
      .select("*, channel:repurpose_source_channels(channel_name, channel_username)")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ site: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Removes a site and its stored product list (cascade). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { error } = await getSupabaseAdmin().from("product_sites").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
