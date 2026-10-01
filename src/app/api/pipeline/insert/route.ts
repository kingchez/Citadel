import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { classifyVideoUrl, resolveVideoSource } from "@/lib/video-source";
import { notifyRepurposeDownload } from "@/lib/repurpose-download-trigger";
import { addProductsToVideo } from "@/lib/add-products-to-video";
import { parseTimeToSeconds } from "@/lib/repurpose-utils";
import { SUPPORTED_CHANNELS, type SubtitleChoice } from "@/lib/repurpose-types";

const VIDEO_TYPES = ["vertical-shorts", "horizontal-long"];
const SUBTITLE_CHOICES: SubtitleChoice[] = ["yes", "no", "later"];

function bad(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status: 400 });
}

/**
 * Add Video page insert, Viral Shop only for now.
 *  - mode "new"       -> a normal row in `videos`, status `planning`, exactly
 *                        like any other freshly planned video.
 *  - mode "repurpose" -> a row in `repurpose_videos` (its own status flow)
 *                        plus a linked row in `videos` at `planning`, created
 *                        together in one transaction. The videos row is the
 *                        one that later carries the VPS lock.
 * Products are never written here directly: after the video row exists they
 * are added with the same handler the videos page uses (lib/add-products-to-video).
 * Subtitles answer follows the manual: yes/no is written to notes, "later"
 * writes nothing so the planning agent still asks before scene planning.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const mode = body?.mode;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const channel = typeof body?.channel === "string" ? body.channel.trim() : "";
    const videoType = body?.video_type;
    const subtitles: SubtitleChoice = SUBTITLE_CHOICES.includes(body?.subtitles) ? body.subtitles : "later";

    if (mode !== "new" && mode !== "repurpose") return bad("mode must be 'new' or 'repurpose'.");
    if (!title) return bad("Title is required.");
    if (title.length > 200) return bad("Title is too long (200 characters max).");
    if (!(SUPPORTED_CHANNELS as readonly string[]).includes(channel)) {
      return bad("Only Viral Shop is supported on this page for now.");
    }
    if (!VIDEO_TYPES.includes(videoType)) return bad("video_type must be 'vertical-shorts' or 'horizontal-long'.");

    const notes: Record<string, unknown> = {};
    if (subtitles === "yes") {
      notes.subtitles = "yes";
      notes.subtitle_style = "capcut-style word-highlight (default)";
    } else if (subtitles === "no") {
      notes.subtitles = "no";
    }

    const supabase = getSupabaseAdmin();

    if (mode === "new") {
      const { data, error } = await supabase
        .from("videos")
        .insert({
          title,
          channel,
          status: "planning",
          video_type: videoType,
          notes: { ...notes, source: "citadel_add_video" },
        })
        .select("id, title, status")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const products = await addProductsToVideo(data.id, body?.products_raw);
      return NextResponse.json({ mode, video: data, products });
    }

    // mode === "repurpose"
    const source = resolveVideoSource(body?.source_video_url, "Video link");
    if (!source.ok) return bad(source.error);

    const introMode = body?.intro_mode === "replace" ? "replace" : "keep_original";
    let newIntroUrl: string | null = null;
    let newIntroStart: number | null = null;

    if (introMode === "replace") {
      const intro = resolveVideoSource(body?.new_intro_url, "New intro link");
      if (!intro.ok) return bad(intro.error);
      const start = typeof body?.new_intro_start === "string" ? parseTimeToSeconds(body.new_intro_start) : null;
      if (start === null) return bad("New intro start time: use a format like 0:13 or 1:05.");
      newIntroUrl = intro.url;
      newIntroStart = start;
    }

    // YouTube/TikTok page links can't be split directly: they get downloaded
    // into the bucket first (status pending_download). Direct links skip that.
    const needsDownload =
      classifyVideoUrl(source.url) !== "direct" || (introMode === "replace" && !!newIntroUrl && classifyVideoUrl(newIntroUrl) !== "direct");

    // One database transaction creates BOTH the repurpose row and its linked
    // `videos` row (status planning, everything else empty) - so neither can
    // exist without the other. See create_repurpose_with_video() in Supabase.
    const { data, error } = await supabase.rpc("create_repurpose_with_video", {
      p_title: title,
      p_channel: channel,
      p_video_type: videoType,
      p_source_video_url: source.url,
      p_intro_mode: introMode,
      p_new_intro_url: newIntroUrl,
      p_new_intro_start_seconds: newIntroStart,
      p_notes: { ...notes, source: "citadel_add_video" },
      p_needs_download: needsDownload,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const created = Array.isArray(data) ? data[0] : data;
    // Products go straight onto the linked videos row, through the exact
    // same logic the videos page uses.
    const products = await addProductsToVideo(created?.video_id, body?.products_raw);
    // Wake the n8n download workflow right away (a 10-minute sweep there is the backup if this ping is lost).
    if (needsDownload && created?.repurpose_id) await notifyRepurposeDownload(created.repurpose_id);
    return NextResponse.json({
      mode,
      item: { id: created?.repurpose_id, status: needsDownload ? "pending_download" : "pending_split" },
      video: { id: created?.video_id, status: "planning" },
      products,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
