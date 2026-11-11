import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getN8nBaseUrl } from "@/lib/n8n";
import type { MediaAssetEntry } from "@/lib/types";

/**
 * Manually replaces one media asset for a video.
 * Supports both binary file uploads to Google Drive and direct hosted URLs.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const mediaKey: string | undefined = body?.media_key;
    const isDirectUrl: boolean = Boolean(body?.is_direct_url);
    const directUrl: string | undefined = body?.direct_url;
    const filename: string | undefined = body?.filename;
    const mimeType: string | undefined = body?.mime_type;
    const fileBase64: string | undefined = body?.file_base64;

    if (!mediaKey) {
      return NextResponse.json({ error: "media_key is required." }, { status: 400 });
    }

    if (!isDirectUrl && (!filename || !fileBase64)) {
      return NextResponse.json({ error: "filename and file_base64 are required." }, { status: 400 });
    }

    if (isDirectUrl && !directUrl) {
      return NextResponse.json({ error: "direct_url is required." }, { status: 400 });
    }

    let driveFileId: string | undefined;
    let driveUrl: string | undefined;

    if (!isDirectUrl) {
      let n8nBaseUrl: string;
      try {
        n8nBaseUrl = getN8nBaseUrl();
      } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
      }

      const uploadRes = await fetch(`${n8nBaseUrl}/webhook/citadel-upload-article-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "video",
          entity_id: id,
          media_code: mediaKey,
          filename,
          mime_type: mimeType,
          file_base64: fileBase64,
        }),
      });

      if (uploadRes.status === 401) {
        return NextResponse.json(
          { error: "DRIVE_AUTH_ERROR", message: "Google Drive OAuth token expired or invalid." },
          { status: 401 }
        );
      }

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        if (text.includes("DRIVE_AUTH_ERROR")) {
          return NextResponse.json(
            { error: "DRIVE_AUTH_ERROR", message: "Google Drive OAuth token expired or invalid." },
            { status: 401 }
          );
        }
        return NextResponse.json({ error: `Drive upload failed: ${text}` }, { status: 502 });
      }

      const resData = (await uploadRes.json()) as { driveFileId?: string; driveUrl?: string };
      driveFileId = resData.driveFileId;
      driveUrl = resData.driveUrl;
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
    const previous = mediaAssets[mediaKey] || { provided: false };

    // The file being swapped out is no longer needed: register it so Main deletes it after 3 days.
    if (driveFileId && previous.driveFileId && previous.driveFileId !== driveFileId) {
      const { error: registerError } = await supabase.rpc("register_media_for_deletion", {
        p_video_id: id,
        p_ref: previous.driveFileId,
        p_reason: "media_replaced",
      });
      if (registerError) console.error("media_to_delete registration failed:", registerError.message);
    }

    mediaAssets[mediaKey] = {
      ...previous,
      provided: true,
      source: isDirectUrl ? "manual" : "manual",
      status: "provided",
      driveFileId: driveFileId || previous.driveFileId,
      driveUrl: driveUrl || previous.driveUrl,
      direct_url: isDirectUrl ? directUrl : previous.direct_url,
      error: undefined,
      replaced_via_citadel_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("videos")
      .update({ media_assets: mediaAssets, updated_at: new Date().toISOString() })
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
