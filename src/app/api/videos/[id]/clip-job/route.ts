import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { MAX_SOURCES, newSourceItem } from "@/lib/repurpose-sources";
import { resolveVideoSource } from "@/lib/video-source";
import type { ProductEntry } from "@/lib/types";

/**
 * "Clip products" for a video that is NOT repurposed. A clip job is a repurpose row made only for clipping: it is
 * attached to the existing video (video_id) and marked notes.clip_job = true. It goes through the same download ->
 * split -> voice-timing flows, the product finder proposes the products and where they appear, King confirms on the
 * Product Clips page, the clip worker cuts them, and a cleanup step then deletes the job and its temporary files.
 */

async function findOpenJob(videoId: string) {
  const { data } = await getSupabaseAdmin()
    .from("repurpose_videos")
    .select("id, status, products_step, sources, error_details, created_at, updated_at")
    .eq("video_id", videoId)
    .eq("notes->>clip_job", "true")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data: video, error } = await getSupabaseAdmin().from("videos").select("id, repurpose_id").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    // A repurposed video already has its own products step on the Product Clips page.
    const eligible = video.repurpose_id === null;
    return NextResponse.json({ eligible, job: eligible ? await findOpenJob(id) : null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const raw: unknown[] = Array.isArray(body?.urls)
      ? body.urls
      : typeof body?.urls === "string"
        ? body.urls.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean)
        : [];
    if (raw.length < 1) return NextResponse.json({ error: "Add at least one video link." }, { status: 400 });
    if (raw.length > MAX_SOURCES) return NextResponse.json({ error: `At most ${MAX_SOURCES} videos.` }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: video, error } = await supabase
      .from("videos")
      .select("id, title, channel, video_type, repurpose_id, with_product, product_ids")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    if (video.repurpose_id !== null) {
      return NextResponse.json({ error: "This video is a repurposed video - its products are handled on the Product Clips page." }, { status: 409 });
    }
    if (await findOpenJob(id)) {
      return NextResponse.json({ error: "A clip job is already running for this video." }, { status: 409 });
    }

    // Products already on the video that are in the shop, already cut, or deliberately clip-less need nothing more.
    // If that is every product, there is nothing to clip (no download, no transcription).
    const items: ProductEntry[] = Array.isArray(video.product_ids) ? video.product_ids : [];
    if (items.length > 0 && items.every((p) => p.clip === "exists" || p.clip === "done" || p.clip === "none")) {
      return NextResponse.json({ error: "Every product on this video is already in the shop or already has its clip - nothing to clip." }, { status: 409 });
    }

    const sources = [];
    for (let i = 0; i < raw.length; i++) {
      const resolved = resolveVideoSource(raw[i], raw.length > 1 ? `Video ${i + 1}` : "Video link");
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
      sources.push(newSourceItem(resolved.url, i));
    }

    const { data: job, error: insertError } = await supabase
      .from("repurpose_videos")
      .insert({
        title: video.title,
        channel: video.channel,
        video_type: video.video_type,
        status: "pending_download",
        sources,
        video_id: id,
        notes: { clip_job: true },
      })
      .select("id")
      .single();
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // The shop pass for this video's products now waits for the clips (it never blocks producing the video).
    if (video.with_product && items.length > 0) {
      await supabase.from("videos").update({ Products_Processing_Status: "awaiting_clips" }).eq("id", id);
    }
    return NextResponse.json({ ok: true, job_id: job.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

/** Cancel the open clip job: the cleanup step deletes its files and row, and the video's products go on without clips. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const job = await findOpenJob(id);
    if (!job) return NextResponse.json({ error: "There is no clip job to cancel." }, { status: 404 });
    const { error } = await getSupabaseAdmin().from("repurpose_videos").update({ status: "cancelled" }).eq("id", job.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
