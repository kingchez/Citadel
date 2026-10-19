import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveVideoSource } from "@/lib/video-source";
import { addProductsToVideo } from "@/lib/add-products-to-video";
import { parseTimeToSeconds } from "@/lib/repurpose-utils";
import { MAX_SOURCES, newSourceItem } from "@/lib/repurpose-sources";
import { SUPPORTED_CHANNELS, type SubtitleChoice } from "@/lib/repurpose-types";
import { DIRECTION_VALUES, type DirectionChoice, type ScriptChoice } from "@/lib/video-options";

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
 * Priority: `priority: true` flags the linked `videos` row (same boolean the news "convert to video" flow sets).
 * Channel scout: `scraped_video_id` is the review-pool row this video came from. It must still exist (so a video can't
 * be queued twice) and is deleted once the video is safely queued.
 * Hold for merge: `hold_for_merge: true` (repurpose mode) puts the new item in waiting_merge so the pipeline leaves it alone
 * until the merge is finished.
 * Notes (King's instructions for the agent, one item each) go to the LINKED `videos` row only. Subtitles answer follows the manual: yes/no is written to notes, "later"
 * writes nothing so the planning agent still asks before scene planning.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const mode = body?.mode;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const channel = typeof body?.channel === "string" ? body.channel.trim() : "";
    const videoType = body?.video_type;
    const priority = body?.priority === true;
    const holdForMerge = mode === "repurpose" && body?.hold_for_merge === true;
    const scrapedVideoId = typeof body?.scraped_video_id === "string" && body.scraped_video_id ? body.scraped_video_id : null;
    const subtitles: SubtitleChoice = SUBTITLE_CHOICES.includes(body?.subtitles) ? body.subtitles : "later";
    const changeScript: ScriptChoice = body?.change_script === "yes" || body?.change_script === "no" ? body.change_script : "later";
    const direction: DirectionChoice = (DIRECTION_VALUES as readonly string[]).includes(body?.product_direction) ? body.product_direction : "later";

    if (mode !== "new" && mode !== "repurpose") return bad("mode must be 'new' or 'repurpose'.");
    if (!title) return bad("Title is required.");
    if (title.length > 200) return bad("Title is too long (200 characters max).");
    if (!(SUPPORTED_CHANNELS as readonly string[]).includes(channel)) {
      return bad("Only Viral Shop is supported on this page for now.");
    }
    if (!VIDEO_TYPES.includes(videoType)) return bad("video_type must be 'vertical-shorts' or 'horizontal-long'.");

    // Notes = ONLY what King typed. Each instruction is its own item (note_1, note_2, ...), plus the subtitles
    // choice if he made one. Nothing is added automatically; no notes at all = the field stays empty (null).
    const notes: Record<string, unknown> = {};
    const instructions: unknown[] = Array.isArray(body?.instructions) ? body.instructions : [];
    let n = 0;
    for (const raw of instructions) {
      const text = typeof raw === "string" ? raw.trim() : "";
      if (!text) continue;
      if (text.length > 2000) return bad("An instruction is too long (2000 characters max).");
      n += 1;
      notes[`note_${n}`] = text;
    }
    if (subtitles === "yes") {
      notes.subtitles = "yes";
      notes.subtitle_style = "capcut-style word-highlight (default)";
    } else if (subtitles === "no") {
      notes.subtitles = "no";
    }
    // Same rule as subtitles: yes/no (or a direction) is written, "later" writes nothing so the agent asks.
    if (changeScript !== "later") notes.change_product_video_script = changeScript;
    if (direction !== "later") notes.product_listing_direction = direction;
    const notesOrNull = Object.keys(notes).length > 0 ? notes : null;

    const supabase = getSupabaseAdmin();

    if (mode === "new") {
      const { data, error } = await supabase
        .from("videos")
        .insert({
          title,
          channel,
          status: "planning",
          video_type: videoType,
          notes: notesOrNull,
          ...(priority ? { priority: true } : {}),
        })
        .select("id, title, status")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const products = await addProductsToVideo(data.id, body?.products_raw);
      return NextResponse.json({ mode, video: data, products });
    }

    if (scrapedVideoId) {
      const pooled = await supabase.from("repurpose_scraped_videos").select("id").eq("id", scrapedVideoId).maybeSingle();
      if (pooled.error) return NextResponse.json({ error: pooled.error.message }, { status: 500 });
      if (!pooled.data) {
        return NextResponse.json({ error: "That video is no longer in the review pool (it was already added or removed). Refresh the list." }, { status: 409 });
      }
    }

    // mode === "repurpose": one video (single) or several (merge) - each link becomes one json item.
    const rawUrls: unknown[] = Array.isArray(body?.source_video_urls)
      ? body.source_video_urls
      : body?.source_video_url
        ? [body.source_video_url]
        : [];
    if (rawUrls.length < 1) return bad("Add at least one video link.");
    if (rawUrls.length > MAX_SOURCES) return bad(`At most ${MAX_SOURCES} videos can be merged.`);
    const sources = [];
    for (let i = 0; i < rawUrls.length; i++) {
      const resolved = resolveVideoSource(rawUrls[i], rawUrls.length > 1 ? `Video ${i + 1}` : "Video link");
      if (!resolved.ok) return bad(resolved.error);
      sources.push(newSourceItem(resolved.url, i));
    }

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

    // One database transaction creates BOTH the repurpose row and its linked
    // `videos` row (status planning, everything else empty) - so neither can
    // exist without the other. See create_repurpose_with_video() in Supabase.
    const { data, error } = await supabase.rpc("create_repurpose_with_video", {
      p_title: title,
      p_channel: channel,
      p_video_type: videoType,
      p_sources: sources,
      p_intro_mode: introMode,
      p_new_intro_url: newIntroUrl,
      p_new_intro_start_seconds: newIntroStart,
      p_notes: notesOrNull,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const created = Array.isArray(data) ? data[0] : data;
    // The video is created at this point; anything below that fails is reported as a warning, not an error,
    // so the page never claims nothing was saved.
    const warnings: string[] = [];
    if (holdForMerge) {
      const { data: held, error: holdError } = await supabase
        .from("repurpose_videos")
        .update({ status: "waiting_merge" })
        .eq("id", created?.repurpose_id)
        .eq("status", "pending_download")
        .select("id")
        .maybeSingle();
      if (holdError || !held) warnings.push("It was added, but couldn't be put on hold for merging (processing may have already started).");
    }
    if (priority) {
      const { error: prioError } = await supabase.from("videos").update({ priority: true }).eq("id", created?.video_id);
      if (prioError) warnings.push(`It was added, but couldn't be marked priority: ${prioError.message}`);
    }
    if (scrapedVideoId) {
      const { error: delError } = await supabase.from("repurpose_scraped_videos").delete().eq("id", scrapedVideoId);
      if (delError) warnings.push(`It was added, but couldn't be removed from the review pool: ${delError.message}`);
    }
    // Products go straight onto the linked videos row, through the exact
    // same logic the videos page uses.
    const products = await addProductsToVideo(created?.video_id, body?.products_raw);
    // Every item starts at pending_download. The n8n download cron picks it up: YouTube/TikTok links are
    // downloaded into the bucket, direct links pass straight through, then the item becomes pending_split.
    return NextResponse.json({
      mode,
      item: { id: created?.repurpose_id, status: "pending_download" },
      video: { id: created?.video_id, status: "planning" },
      products,
      warnings,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
