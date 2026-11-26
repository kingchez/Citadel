import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const HIGHLIGHT_WEBHOOK_URL =
  process.env.N8N_NEWS_HIGHLIGHT_WEBHOOK_URL ||
  "https://n8n.viralnotely.com/webhook/news-highlight-video";

/** Triggers or approves the on-demand News Highlight Reel for a batch_id.
 * On trigger/redo, resets batch_highlight_done = false on the batch's events
 * and surfaces Drive/workflow errors immediately. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      batch_id?: string;
      action?: "trigger" | "approve";
    };
    const batchId = body.batch_id?.trim();
    const action = body.action || "trigger";

    if (!batchId) {
      return NextResponse.json({ error: "batch_id is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (action === "approve") {
      const { error } = await supabase
        .from("news_highlight_reels")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("batch_id", batchId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, status: "approved", batch_id: batchId });
    }

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

    // Reset batch_highlight_done = false so Redo / re-runs can process the batch
    const { error: resetErr } = await supabase
      .from("events")
      .update({ batch_highlight_done: false })
      .eq("batch_id", batchId)
      .eq("status", "scheduled")
      .eq("post_format", "static");

    if (resetErr) {
      return NextResponse.json({ error: resetErr.message }, { status: 500 });
    }

    const res = await fetch(HIGHLIGHT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batch_id: batchId }),
    });

    const payload = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      needsDriveReconnect?: boolean;
      status?: string;
    } | null;

    if (!res.ok || payload?.ok === false) {
      const errMsg = payload?.error || `n8n webhook error (${res.status})`;
      await supabase
        .from("news_highlight_reels")
        .upsert(
          {
            batch_id: batchId,
            status: "failed",
            error_message: errMsg,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "batch_id" }
        );

      return NextResponse.json(
        {
          error: errMsg,
          needsDriveReconnect: Boolean(payload?.needsDriveReconnect),
        },
        { status: res.status >= 400 ? res.status : 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: payload?.status || "processing",
      batch_id: batchId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
