import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MediaItem } from "@/lib/news-types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("Trend_Processing")
      .select("*, events:events_id(id, event_title, fingerprint, snapshot_summary, global_relevance_score, confidence)")
      .eq("id", id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
    }

    return NextResponse.json({ trend: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function validMedia(value: unknown): value is MediaItem[] {
  return (
    Array.isArray(value) &&
    value.every((m) => {
      if (!m || typeof m !== "object" || typeof m.url !== "string" || m.url === "") return false;
      if (m.description !== undefined && typeof m.description !== "string") return false;
      if (m.type === "image") return true;
      return (
        m.type === "clip" &&
        typeof m.start === "number" &&
        typeof m.end === "number" &&
        m.start >= 0 &&
        m.end > m.start
      );
    })
  );
}

function validThumbnails(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((u) => typeof u === "string" && u !== "");
}

/** Saves the reviewer's choices.
 * - status "approved": updates Trend_Processing to "processed" (releasing it to
 *   the n8n Signal Analysis & Article Generation lane) and syncs post_format,
 *   thumbnails, selected_media, voiceover, render_mode, and any edited event
 *   fields onto the linked `events` row.
 * - status "rejected": immediately deletes BOTH the Trend_Processing row and
 *   its linked `events` row. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const { data: current, error: readError } = await supabase
      .from("Trend_Processing")
      .select("status, events_id, post_format, selected_thumbnail, selected_thumbnails, selected_media, voiceover, render_mode")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: readError.code === "PGRST116" ? 404 : 500 });
    }
    if (current.status !== "needs_review") {
      return NextResponse.json({ error: "This trend is no longer waiting for review." }, { status: 409 });
    }

    if (body.status === "rejected") {
      const eventId = current.events_id;
      const { error: delTrendErr } = await supabase
        .from("Trend_Processing")
        .delete()
        .eq("id", id);

      if (delTrendErr) {
        return NextResponse.json({ error: delTrendErr.message }, { status: 500 });
      }

      if (eventId != null) {
        const { error: delEventErr } = await supabase
          .from("events")
          .delete()
          .eq("id", eventId);

        if (delEventErr) {
          return NextResponse.json({ error: delEventErr.message }, { status: 500 });
        }
      }

      return NextResponse.json({ deleted: true, id: Number(id), events_id: eventId ?? null });
    }

    const update: Record<string, unknown> = {};

    if ("post_format" in body) {
      if (body.post_format !== "video" && body.post_format !== "static" && body.post_format !== null) {
        return NextResponse.json({ error: "post_format must be 'video' or 'static'." }, { status: 400 });
      }
      update.post_format = body.post_format;
    }
    if ("selected_thumbnails" in body) {
      if (!validThumbnails(body.selected_thumbnails)) {
        return NextResponse.json({ error: "selected_thumbnails must be a list of image URLs." }, { status: 400 });
      }
      update.selected_thumbnails = body.selected_thumbnails;
      // The first one is the main thumbnail the rest of the pipeline uses.
      update.selected_thumbnail = body.selected_thumbnails[0] ?? null;
    }
    if ("selected_media" in body) {
      if (!validMedia(body.selected_media)) {
        return NextResponse.json(
          { error: "Each clip needs a start time before its end time, and every item needs a URL." },
          { status: 400 }
        );
      }
      update.selected_media = body.selected_media;
    }
    if ("voiceover" in body) {
      if (typeof body.voiceover !== "boolean") {
        return NextResponse.json({ error: "voiceover must be true or false." }, { status: 400 });
      }
      update.voiceover = body.voiceover;
    }
    if ("render_mode" in body) {
      if (body.render_mode !== "canva" && body.render_mode !== "render" && body.render_mode !== null) {
        return NextResponse.json({ error: "render_mode must be 'canva' or 'render'." }, { status: 400 });
      }
      update.render_mode = body.render_mode;
    }

    const eventUpdate: Record<string, unknown> = {};
    if (typeof body.event_title === "string" && body.event_title.trim()) {
      eventUpdate.event_title = body.event_title.trim();
    }
    if (typeof body.snapshot_summary === "string" && body.snapshot_summary.trim()) {
      eventUpdate.snapshot_summary = body.snapshot_summary.trim();
    }
    if (typeof body.fingerprint === "string" && body.fingerprint.trim()) {
      eventUpdate.fingerprint = body.fingerprint.trim();
    }

    if (body.status === "approved") {
      const format = (update.post_format ?? current.post_format) as string | null;
      const thumbnails = (update.selected_thumbnails ?? current.selected_thumbnails ?? []) as string[];
      const media = (update.selected_media ?? current.selected_media ?? []) as MediaItem[];

      if (thumbnails.length === 0) {
        return NextResponse.json({ error: "Select at least one thumbnail before approving." }, { status: 400 });
      }
      if (format !== "video" && format !== "static") {
        return NextResponse.json({ error: "Choose Video or Static before approving." }, { status: 400 });
      }
      if (format === "video" && media.length === 0) {
        return NextResponse.json({ error: "Add at least one clip or image to a video post." }, { status: 400 });
      }
      const voiceover = (update.voiceover ?? current.voiceover) as boolean;
      const renderMode = (update.render_mode ?? current.render_mode ?? (voiceover ? "render" : "canva")) as string;
      if (format === "video" && !voiceover && media.some((m) => !m.description || !m.description.trim())) {
        return NextResponse.json(
          { error: "Describe what each image or clip shows, so the captions can match it." },
          { status: 400 }
        );
      }
      if (format === "static") {
        // Static posts have no video content and no voice-over.
        update.selected_media = [];
        update.voiceover = false;
        update.render_mode = null;
      } else {
        update.render_mode = voiceover ? "render" : renderMode;
      }
      // "processed" releases the trend to the n8n Signal Analysis & Article Generation lane ("Get processed Trend")
      update.status = "processed";
      update.reviewed_at = new Date().toISOString();

      eventUpdate.post_format = format;
      eventUpdate.thumbnail = thumbnails[0] ?? null;
      eventUpdate.selected_thumbnails = thumbnails;
      eventUpdate.selected_media = format === "static" ? [] : media;
      eventUpdate.voiceover = format === "static" ? false : voiceover;
      eventUpdate.render_mode = format === "static" ? null : (voiceover ? "render" : renderMode);
    } else if ("status" in body) {
      return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });
    }

    if (Object.keys(update).length === 0 && Object.keys(eventUpdate).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    if (current.events_id != null && Object.keys(eventUpdate).length > 0) {
      const { error: eventErr } = await supabase
        .from("events")
        .update(eventUpdate)
        .eq("id", current.events_id);

      if (eventErr) {
        return NextResponse.json({ error: eventErr.message }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from("Trend_Processing")
      .update(update)
      .eq("id", id)
      .eq("status", "needs_review")
      .select("*, events:events_id(id, event_title, fingerprint, snapshot_summary, global_relevance_score, confidence)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trend: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
