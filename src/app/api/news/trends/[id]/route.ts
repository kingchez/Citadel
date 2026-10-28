import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MediaItem } from "@/lib/news-types";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("Trend_Processing").select("*").eq("id", id).single();

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
      if (m.type === "image") return true;
      return (
        m.type === "clip" &&
        typeof m.start === "number" &&
        typeof m.end === "number" &&
        m.start >= 0 &&
        m.end > m.start &&
        (m.note === undefined || typeof m.note === "string")
      );
    })
  );
}

function validThumbnails(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((u) => typeof u === "string" && u !== "");
}

/** Saves the reviewer's choices. status "approved" releases the trend to the
 * event builder in n8n, "rejected" keeps the row (so the same trend isn't
 * fetched again) but nothing else happens to it. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = getSupabaseAdmin();

    const { data: current, error: readError } = await supabase
      .from("Trend_Processing")
      .select("status, post_format, selected_thumbnails, selected_media, voiceover")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: readError.code === "PGRST116" ? 404 : 500 });
    }
    if (current.status !== "needs_review") {
      return NextResponse.json({ error: "This trend is no longer waiting for review." }, { status: 409 });
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
      if (format === "static") {
        // Static posts have no video content and no voice-over.
        update.selected_media = [];
        update.voiceover = false;
      }
      update.status = "approved";
      update.reviewed_at = new Date().toISOString();
    } else if (body.status === "rejected") {
      update.status = "rejected";
      update.reviewed_at = new Date().toISOString();
    } else if ("status" in body) {
      return NextResponse.json({ error: "status must be 'approved' or 'rejected'." }, { status: 400 });
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("Trend_Processing")
      .update(update)
      .eq("id", id)
      .eq("status", "needs_review")
      .select()
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
