import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Hold an item for merging, or release it.
 *   { hold: true }  pending_download -> waiting_merge   (the n8n crons skip it while videos are still being added)
 *   { hold: false } waiting_merge    -> pending_download (merge finished: the pipeline picks it up and carries on)
 * Both are guarded on the status just read, so an item that has already started processing can't be put on hold.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body?.hold !== "boolean") return NextResponse.json({ error: "hold must be true or false." }, { status: 400 });

    const from = body.hold ? "pending_download" : "waiting_merge";
    const to = body.hold ? "waiting_merge" : "pending_download";

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("repurpose_videos")
      .update({ status: to, error_details: null })
      .eq("id", id)
      .eq("status", from)
      .select("id, status")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) {
      return NextResponse.json(
        { error: body.hold ? "Only an item that hasn't started processing yet can be held for a merge." : "That item isn't waiting for a merge." },
        { status: 409 }
      );
    }
    return NextResponse.json({ item: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
