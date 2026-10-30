import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { validateScenes } from "@/lib/news-scenes";
import type { CanvaTemplate, Scene } from "@/lib/news-types";

/**
 * Actions on one Canva short:
 *  - retry:     a failed short goes back to the step it can resume from
 *  - save_plan: store edits to the scene plan (only while it waits for approval)
 *  - approve:   release the plan to download/cut/Canva (optionally with edits)
 *  - replan:    throw the plan away and have the planner make a new one
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
      .from("news_shorts")
      .select("status, scenes")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: readError.code === "PGRST116" ? 404 : 500 });
    }

    const status = current.status as string;
    const scenes = (current.scenes || []) as Scene[];
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (action === "retry") {
      if (status !== "error") {
        return NextResponse.json({ error: "Only failed shorts can be retried." }, { status: 409 });
      }
      const mediaReady =
        scenes.length > 0 &&
        scenes.every((s) => s.kind === "intro" || s.kind === "outro" || (s.media_urls && s.media_urls.length > 0));
      update.status = mediaReady ? "media_ready" : scenes.length > 0 ? "approved" : "queued";
      update.error = null;
    } else if (action === "replan") {
      if (status !== "plan_ready" && status !== "error") {
        return NextResponse.json({ error: "This short can't be re-planned right now." }, { status: 409 });
      }
      update.status = "queued";
      update.scenes = [];
      update.error = null;
    } else {
      if (status !== "plan_ready") {
        return NextResponse.json({ error: "The plan can only be changed while it is waiting for approval." }, { status: 409 });
      }
      const { data: templates, error: tplError } = await supabase.from("canva_templates").select("*");
      if (tplError) {
        return NextResponse.json({ error: tplError.message }, { status: 500 });
      }
      const checked = validateScenes(action === "approve" && body.scenes === undefined ? scenes : body.scenes, templates as CanvaTemplate[]);
      if (typeof checked === "string") {
        return NextResponse.json({ error: checked }, { status: 400 });
      }
      update.scenes = checked;
      if (action === "approve") {
        update.status = "approved";
        update.error = null;
      }
    }

    const { data, error } = await supabase
      .from("news_shorts")
      .update(update)
      .eq("id", id)
      .eq("status", status)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 409 : 500 });
    }

    return NextResponse.json({ short: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
