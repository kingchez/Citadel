import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { extractDriveFileId } from "@/lib/utils";
import { parseProductInput } from "@/lib/product-input";
import { isDriveFolderUrl, parseTimeToSeconds } from "@/lib/repurpose-utils";
import { SUPPORTED_CHANNELS, type SubtitleChoice } from "@/lib/repurpose-types";

const VIDEO_TYPES = ["vertical-shorts", "horizontal-long"];
const SUBTITLE_CHOICES: SubtitleChoice[] = ["yes", "no", "later"];

function bad(message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status: 400 });
}

/** Validates a Drive link and returns its file id, or an error message. */
function driveFileId(url: unknown, label: string): { id: string } | { error: string } {
  if (typeof url !== "string" || !url.trim()) return { error: `${label}: paste a Google Drive link.` };
  const trimmed = url.trim();
  if (isDriveFolderUrl(trimmed)) return { error: `${label}: that is a folder link - use the link to the video file itself.` };
  const id = extractDriveFileId(trimmed);
  if (!id) return { error: `${label}: couldn't find a Drive file id in that link.` };
  return { id };
}

/**
 * Add Video page insert, Viral Shop only for now.
 *  - mode "new"       -> a normal row in `videos`, status `planning`, exactly
 *                        like any other freshly planned video.
 *  - mode "repurpose" -> a row in `repurpose_videos` (its own status flow).
 *                        Nothing in the main videos pipeline sees it until a
 *                        later handoff creates the real video.
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

    const { products, failed } = await parseProductInput(body?.products_raw);
    if (failed.length > 0) {
      return bad("Some product links/ASINs couldn't be read. Nothing was saved.", { failed });
    }

    const notes: Record<string, unknown> = {};
    if (subtitles === "yes") {
      notes.subtitles = "yes";
      notes.subtitle_style = "capcut-style word-highlight (default)";
    } else if (subtitles === "no") {
      notes.subtitles = "no";
    }

    const supabase = getSupabaseAdmin();

    if (mode === "new") {
      const insert: Record<string, unknown> = {
        title,
        channel,
        status: "planning",
        video_type: videoType,
        notes: { ...notes, source: "citadel_add_video" },
      };
      if (products.length > 0) {
        insert.product_ids = products;
        insert.with_product = true;
      }

      const { data, error } = await supabase.from("videos").insert(insert).select("id, title, status").single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ mode, video: data });
    }

    // mode === "repurpose"
    const source = driveFileId(body?.source_video_url, "Video link");
    if ("error" in source) return bad(source.error);

    const introMode = body?.intro_mode === "replace" ? "replace" : "keep_original";
    const row: Record<string, unknown> = {
      title,
      channel,
      video_type: videoType,
      source_video_url: String(body.source_video_url).trim(),
      source_video_file_id: source.id,
      intro_mode: introMode,
      with_product: products.length > 0,
      product_ids: products,
      notes: { ...notes, source: "citadel_add_video" },
    };

    if (introMode === "replace") {
      const intro = driveFileId(body?.new_intro_url, "New intro link");
      if ("error" in intro) return bad(intro.error);
      const start = typeof body?.new_intro_start === "string" ? parseTimeToSeconds(body.new_intro_start) : null;
      if (start === null) return bad("New intro start time: use a format like 0:13 or 1:05.");
      row.new_intro_url = String(body.new_intro_url).trim();
      row.new_intro_file_id = intro.id;
      row.new_intro_start_seconds = start;
    }

    const { data, error } = await supabase.from("repurpose_videos").insert(row).select("id, title, status").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ mode, item: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
