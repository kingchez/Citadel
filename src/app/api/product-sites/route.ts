import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { assertPublicHttpUrl } from "@/lib/product-sites";

const SELECT = "*, channel:repurpose_source_channels(channel_name, channel_username)";

/** All product sites (optionally only one channel's), each with its channel's name. */
export async function GET(request: NextRequest) {
  try {
    const channelId = request.nextUrl.searchParams.get("channel_id");
    let q = getSupabaseAdmin().from("product_sites").select(SELECT).order("created_at", { ascending: true });
    if (channelId) q = q.eq("source_channel_id", channelId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ sites: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Adds a site. Reading its product list is a separate call (/api/product-sites/[id]/sync) so its errors show on their own. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
    let url: URL;
    try {
      url = assertPublicHttpUrl(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid link." }, { status: 400 });
    }
    const label = (typeof body?.label === "string" && body.label.trim()) || url.hostname.replace(/^www\./, "");
    const mode = body?.mode === "json" ? "json" : "html";
    const pagePattern = typeof body?.page_pattern === "string" && body.page_pattern.trim() ? body.page_pattern.trim() : null;
    if (pagePattern && !pagePattern.includes("{n}")) {
      return NextResponse.json({ error: "The pages pattern must contain {n}, e.g. https://site.com/products?page={n}." }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("product_sites")
      .insert({
        url: url.toString(),
        label: label.slice(0, 80),
        mode,
        item_selector: typeof body?.item_selector === "string" && body.item_selector.trim() ? body.item_selector.trim() : null,
        page_pattern: pagePattern,
        source_channel_id: typeof body?.source_channel_id === "string" && body.source_channel_id ? body.source_channel_id : null,
      })
      .select(SELECT)
      .single();
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "That site is already added." }, { status: 409 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ site: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
