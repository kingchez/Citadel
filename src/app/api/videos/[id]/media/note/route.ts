import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { MediaAssetEntry } from "@/lib/types";

/** Sets/clears the freeform note on one media asset. Pure database write -
 * straight to Supabase, no n8n involved. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mediaKey: string | undefined = body?.media_key;
    const note: string = typeof body?.note === "string" ? body.note : "";

    if (!mediaKey) {
      return NextResponse.json({ error: "media_key is required." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase
      .from("videos")
      .select("media_assets")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const mediaAssets: Record<string, MediaAssetEntry> = video?.media_assets || {};
    if (!mediaAssets[mediaKey]) {
      return NextResponse.json({ error: `No media asset at key "${mediaKey}".` }, { status: 404 });
    }

    mediaAssets[mediaKey] = { ...mediaAssets[mediaKey], citadel_note: note.trim() || undefined };

    const { data, error } = await supabase
      .from("videos")
      .update({ media_assets: mediaAssets })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ video: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
