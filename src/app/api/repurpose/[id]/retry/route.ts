import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { notifyRepurposeDownload } from "@/lib/repurpose-download-trigger";
import { REPURPOSE_RETRY_TARGET, type RepurposeStatus } from "@/lib/repurpose-types";

/**
 * Retry a failed repurpose item: moves it back to the step that failed
 * (download_error -> pending_download, split_error -> pending_split,
 * voice_timing_error -> split_done) and clears the error message. Only works
 * on an item that is currently in one of those error states, so it can't
 * disturb anything that is running.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();

    const { data: item, error: readError } = await supabase.from("repurpose_videos").select("id, status").eq("id", id).maybeSingle();
    if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
    if (!item) return NextResponse.json({ error: "Item not found." }, { status: 404 });

    const target = REPURPOSE_RETRY_TARGET[item.status as RepurposeStatus];
    if (!target) return NextResponse.json({ error: `Nothing to retry - the item is "${item.status}".` }, { status: 409 });

    // Guarded update: only applies if it is STILL in the error state we just read.
    const { data: updated, error } = await supabase
      .from("repurpose_videos")
      .update({ status: target, error_details: null })
      .eq("id", id)
      .eq("status", item.status)
      .select("id, status")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "The item changed while retrying - refresh and try again." }, { status: 409 });

    if (target === "pending_download") await notifyRepurposeDownload(id);
    return NextResponse.json({ item: updated });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
