import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getN8nBaseUrl } from "@/lib/n8n";

export const maxDuration = 300;

/**
 * Sends the pasted script + the channel's product website link(s) to the n8n "Product Search" workflow and
 * returns what it answers: for each product in the script, the decision and the Amazon ASIN(s).
 * Citadel does no searching itself - n8n extracts the names, searches the site(s) and decides.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const script = typeof body?.script === "string" ? body.script.trim() : "";
    const channelId = typeof body?.channel_id === "string" ? body.channel_id : "";
    if (script.length < 20) return NextResponse.json({ error: "Paste the script first." }, { status: 400 });
    if (!channelId) return NextResponse.json({ error: "This video has no source channel." }, { status: 400 });

    const { data, error } = await getSupabaseAdmin().from("repurpose_source_channels").select("product_sites").eq("id", channelId).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const sites: string[] = Array.isArray(data?.product_sites) ? data.product_sites : [];
    if (sites.length === 0) {
      return NextResponse.json({ error: "This channel has no product website yet. Add it under Channels first." }, { status: 400 });
    }

    const res = await fetch(`${getN8nBaseUrl()}/webhook/product-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script, sites }),
      signal: AbortSignal.timeout(280000),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: `n8n answered ${res.status} without JSON. Is the "Product Search" workflow published?` }, { status: 502 });
    }
    if (!res.ok) return NextResponse.json({ error: (json as { message?: string })?.message || `n8n answered ${res.status}.` }, { status: 502 });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
