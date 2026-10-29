import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Only action: "retry" puts a failed short back in the queue. If its merged
 * video already exists it resumes at the Canva step, otherwise it starts over. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "retry") {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
      .from("news_shorts")
      .select("status, media_url")
      .eq("id", id)
      .single();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: readError.code === "PGRST116" ? 404 : 500 });
    }
    if (current.status !== "error") {
      return NextResponse.json({ error: "Only failed shorts can be retried." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("news_shorts")
      .update({
        status: current.media_url ? "media_ready" : "queued",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "error")
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ short: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
