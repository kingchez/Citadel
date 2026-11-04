import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validateScenes } from "@/lib/news-scenes";
import type { CanvaTemplate } from "@/lib/news-types";

/**
 * Actions on the Canva scene plan of one voiceless (render_mode = 'canva') video:
 *  - save_plan: store edits to the plan (only while it waits for approval: scenes_planned)
 *  - approve:   release the plan to download/cut/Canva (scenes_planned -> awaiting_media), optionally with edits
 *  - replan:    throw the plan away and have the planner make a new one (-> planning)
 *  - retry:     a failed video (render_error) resumes from the step it can, via request_render_retry()
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action = body.action as string;
    if (!["retry", "save_plan", "approve", "replan"].includes(action)) {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("videos")
      .select("status, scenes, render_mode, vps_in_use")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: readError.code === "PGRST116" ? 404 : 500 });
    }
    if (current.render_mode !== "canva") {
      return NextResponse.json({ error: "This video is not a Canva video." }, { status: 409 });
    }

    const status = current.status as string;

    if (action === "retry") {
      if (status !== "render_error") {
        return NextResponse.json({ error: "Only failed videos can be retried." }, { status: 409 });
      }
      const { error } = await supabase.rpc("request_render_retry", { p_video_id: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === "replan") {
      if (status !== "scenes_planned" && status !== "render_error") {
        return NextResponse.json({ error: "This video can't be re-planned right now." }, { status: 409 });
      }
      if (current.vps_in_use) {
        return NextResponse.json({ error: "A job is still running on this video. Wait for it to finish." }, { status: 409 });
      }
      update.status = "planning";
      update.scenes = [];
      update.error_details = null;
      update.vps_status = null;
      update.vps_job_triggered_at = null;
    } else {
      if (status !== "scenes_planned") {
        return NextResponse.json({ error: "The plan can only be changed while it is waiting for approval." }, { status: 409 });
      }
      const { data: templates, error: tplError } = await supabase.from("canva_templates").select("*");
      if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 });
      const source = action === "approve" && body.scenes === undefined ? current.scenes : body.scenes;
      const checked = validateScenes(source, templates as CanvaTemplate[]);
      if (typeof checked === "string") return NextResponse.json({ error: checked }, { status: 400 });
      update.scenes = checked;
      if (action === "approve") {
        update.status = "awaiting_media";
        update.error_details = null;
      }
    }

    const { data, error } = await supabase
      .from("videos")
      .update(update)
      .eq("id", id)
      .eq("status", status)
      .select("id, status, scenes")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 409 : 500 });
    }
    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
