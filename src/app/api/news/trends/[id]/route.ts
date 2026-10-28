import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SelectedVideo } from "@/lib/news-types";

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

function validSelectedVideos(value: unknown): value is SelectedVideo[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === "object" &&
        typeof v.url === "string" &&
        v.url !== "" &&
        typeof v.start === "number" &&
        typeof v.end === "number" &&
        v.start >= 0 &&
        v.end > v.start &&
        (v.note === undefined || typeof v.note === "string")
    )
  );
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
      .select("status, post_format, selected_thumbnail, selected_videos")
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
    if ("selected_thumbnail" in body) {
      if (body.selected_thumbnail !== null && typeof body.selected_thumbnail !== "string") {
        return NextResponse.json({ error: "selected_thumbnail must be a URL." }, { status: 400 });
      }
      update.selected_thumbnail = body.selected_thumbnail;
    }
    if ("selected_videos" in body) {
      if (!validSelectedVideos(body.selected_videos)) {
        return NextResponse.json(
          { error: "Each selected video needs a URL and a start time before its end time." },
          { status: 400 }
        );
      }
      update.selected_videos = body.selected_videos;
    }

    if (body.status === "approved") {
      const format = (update.post_format ?? current.post_format) as string | null;
      const thumbnail = (update.selected_thumbnail ?? current.selected_thumbnail) as string | null;
      const videos = (update.selected_videos ?? current.selected_videos ?? []) as SelectedVideo[];

      if (!thumbnail) {
        return NextResponse.json({ error: "Select a thumbnail before approving." }, { status: 400 });
      }
      if (format !== "video" && format !== "static") {
        return NextResponse.json({ error: "Choose Video or Static before approving." }, { status: 400 });
      }
      if (format === "video" && videos.length === 0) {
        return NextResponse.json({ error: "Select at least one video (with start and end times) for a video post." }, { status: 400 });
      }
      if (format === "static") {
        update.selected_videos = [];
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
