import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { VideoTranscriptEntry } from "@/lib/news-types";

const CLIP_TRANSCRIPT_WEBHOOK_URL =
  process.env.N8N_CLIP_TRANSCRIPT_WEBHOOK_URL ||
  "https://n8n.viralnotely.com/webhook/news-clip-transcript";

/** Checks live status for a clip transcript, including WhisperX recovery if a callback was missed. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const clipUrl = request.nextUrl.searchParams.get("clip_url")?.trim() || "";
    if (!clipUrl) {
      return NextResponse.json({ error: "clip_url query param is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: trend, error: readErr } = await supabase
      .from("Trend_Processing")
      .select("id, events_id, events:events_id(id, usable_video_transcripts)")
      .eq("id", id)
      .single();

    if (readErr || !trend) {
      return NextResponse.json({ error: readErr?.message || "Trend not found." }, { status: 404 });
    }

    const eventsObj = trend.events as unknown as {
      id: number;
      usable_video_transcripts?: Record<string, VideoTranscriptEntry & { batch_id?: string }> | null;
    } | null;
    const map = eventsObj?.usable_video_transcripts || {};
    const entry = map[clipUrl];

    if (entry?.status === "processing" && entry.batch_id) {
      try {
        const wxRes = await fetch(
          `https://whisperx.viralnotely.com/align_batch_async/${encodeURIComponent(entry.batch_id)}/results`,
          { signal: AbortSignal.timeout(4000) }
        );
        if (wxRes.ok) {
          const pull = await wxRes.json();
          if (pull.status && pull.status !== "processing") {
            const r = Array.isArray(pull.results) ? pull.results[0] || {} : {};
            let updated: VideoTranscriptEntry;
            if (r.status === "success") {
              const segments = Array.isArray(r.segments)
                ? r.segments
                    .map((s: { start: number; end: number; text?: string }) => ({
                      start: s.start,
                      end: s.end,
                      text: String(s.text || "").trim(),
                    }))
                    .filter((s: { text: string }) => s.text)
                : [];
              const text = segments.map((s: { text: string }) => s.text).join(" ").trim() || String(r.text || "").trim();
              updated = {
                status: text ? "done" : "empty",
                language: r.language || "en",
                text,
                segments,
                updated_at: new Date().toISOString(),
              };
            } else {
              updated = {
                status: "error",
                error: String(r.error || "WhisperX returned no transcript"),
                updated_at: new Date().toISOString(),
              };
            }

            const nextMap = { ...map, [clipUrl]: updated };
            await supabase.from("events").update({ usable_video_transcripts: nextMap }).eq("id", trend.events_id);
            fetch(`https://whisperx.viralnotely.com/align_batch_async/${encodeURIComponent(entry.batch_id)}/ack`, {
              method: "POST",
            }).catch(() => {});

            return NextResponse.json({ transcript: updated });
          }
        }
      } catch {
        // WhisperX not reached or job still in Split Audio stage — keep processing state
      }
    }

    return NextResponse.json({ transcript: entry || null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

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

/** Saves a manually pasted transcript (e.g. copied from YouTube) into events.usable_video_transcripts. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const clipUrl = typeof body.clip_url === "string" ? body.clip_url.trim() : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!clipUrl) {
      return NextResponse.json({ error: "clip_url is required." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Transcript text cannot be empty." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: trend, error: readErr } = await supabase
      .from("Trend_Processing")
      .select("id, events_id, events:events_id(id, usable_video_transcripts)")
      .eq("id", id)
      .single();

    if (readErr || !trend) {
      return NextResponse.json({ error: readErr?.message || "Trend not found." }, { status: 404 });
    }
    if (!trend.events_id) {
      return NextResponse.json({ error: "Trend is not linked to an event yet." }, { status: 400 });
    }

    const eventsObj = trend.events as unknown as {
      usable_video_transcripts?: Record<string, VideoTranscriptEntry> | null;
    } | null;
    const existing = eventsObj?.usable_video_transcripts || {};
    const entry: VideoTranscriptEntry = {
      status: "done",
      language: "en",
      text,
      segments: [],
      updated_at: new Date().toISOString(),
    };

    const { error: updErr } = await supabase
      .from("events")
      .update({ usable_video_transcripts: { ...existing, [clipUrl]: entry } })
      .eq("id", trend.events_id);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transcript: entry });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
