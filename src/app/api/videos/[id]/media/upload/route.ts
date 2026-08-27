import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getN8nBaseUrl } from "@/lib/n8n";
import type { MediaAssetEntry } from "@/lib/types";

/**
 * Manually replaces one media asset. Citadel has no Google Drive
 * credentials of its own, so the actual upload is delegated to a tiny n8n
 * webhook that does only that one external action and hands back a
 * driveFileId - Citadel then writes the resulting media_assets entry
 * itself, shaped identically to what the automated pipeline would have
 * produced (driveFileId/status/source) plus a marker that it was a manual
 * swap, so nothing downstream needs to know the difference.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mediaKey: string | undefined = body?.media_key;
    const filename: string | undefined = body?.filename;
    const mimeType: string | undefined = body?.mime_type;
    const fileBase64: string | undefined = body?.file_base64;

    if (!mediaKey || !filename || !fileBase64) {
      return NextResponse.json({ error: "media_key, filename, and file_base64 are required." }, { status: 400 });
    }

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    const uploadRes = await fetch(`${n8nBaseUrl}/webhook/citadel-upload-media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: id, media_key: mediaKey, filename, mime_type: mimeType, file_base64: fileBase64 }),
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text();
      return NextResponse.json({ error: `Drive upload failed: ${text}` }, { status: 502 });
    }

    const { driveFileId } = (await uploadRes.json()) as { driveFileId: string };

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
    const previous = mediaAssets[mediaKey] || { provided: false };

    mediaAssets[mediaKey] = {
      ...previous,
      provided: true,
      source: "manual",
      status: "provided",
      driveFileId,
      error: undefined,
      replaced_via_citadel_at: new Date().toISOString(),
    };

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
