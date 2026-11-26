import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const HIGHLIGHT_WEBHOOK_URL =
  process.env.N8N_NEWS_HIGHLIGHT_WEBHOOK_URL ||
  "https://n8n.viralnotely.com/webhook/news-highlight-video";

/** Triggers the on-demand n8n News Highlight Reel workflow for a batch_id
 * once at least 8 scheduled static events exist in that batch. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { batch_id?: string };
    const batchId = body.batch_id?.trim();

    if (!batchId) {
      return NextResponse.json({ error: "batch_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { count, error } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", batchId)
      .eq("status", "scheduled")
      .eq("post_format", "static");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if ((count ?? 0) < 8) {
      return NextResponse.json(
        { error: `Batch ${batchId} has ${count ?? 0}/8 scheduled static events` },
        { status: 400 }
      );
    }

    const res = await fetch(HIGHLIGHT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `n8n webhook error (${res.status}): ${text || res.statusText}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, batch_id: batchId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
