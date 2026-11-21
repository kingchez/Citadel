import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const CLIP_TRANSCRIPT_WEBHOOK_URL =
  process.env.N8N_CLIP_TRANSCRIPT_WEBHOOK_URL ||
  "https://n8n.viralnotely.com/webhook/news-clip-transcript";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const clipUrl = typeof body.clip_url === "string" ? body.clip_url.trim() : "";

    if (!clipUrl) {
      return NextResponse.json({ error: "clip_url is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: trend, error: readErr } = await supabase
      .from("Trend_Processing")
      .select("id, events_id")
      .eq("id", id)
      .single();

    if (readErr || !trend) {
      return NextResponse.json({ error: readErr?.message || "Trend not found." }, { status: 404 });
    }
    if (!trend.events_id) {
      return NextResponse.json({ error: "Trend is not linked to an event yet." }, { status: 400 });
    }

    const res = await fetch(CLIP_TRANSCRIPT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trend_id: trend.id,
        event_id: trend.events_id,
        clip_url: clipUrl,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.error || `Webhook returned ${res.status}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true, event_id: trend.events_id, clip_url: clipUrl, ...data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
