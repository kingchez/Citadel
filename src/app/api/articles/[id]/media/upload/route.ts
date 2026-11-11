import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getN8nBaseUrl } from "@/lib/n8n";
import type { ArticleMediaInstruction } from "@/lib/article-types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const placeholderId: string | undefined = body?.placeholder_id;
    const mediaIndex: number | undefined = body?.media_index;
    const isDirectUrl: boolean = Boolean(body?.is_direct_url);
    const directUrl: string | undefined = body?.direct_url;
    const filename: string | undefined = body?.filename;
    const mimeType: string | undefined = body?.mime_type;
    const fileBase64: string | undefined = body?.file_base64;

    if (!placeholderId && mediaIndex === undefined) {
      return NextResponse.json(
        { error: "placeholder_id or media_index is required." },
        { status: 400 }
      );
    }

    if (!isDirectUrl && (!filename || !fileBase64)) {
      return NextResponse.json(
        { error: "filename and file_base64 are required for file upload." },
        { status: 400 }
      );
    }

    if (isDirectUrl && !directUrl) {
      return NextResponse.json(
        { error: "direct_url is required when is_direct_url is true." },
        { status: 400 }
      );
    }

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    // Call the universal Citadel media upload webhook in n8n
    const uploadRes = await fetch(
      `${n8nBaseUrl}/webhook/citadel-upload-article-media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity_type: "article",
          entity_id: id,
          media_code: placeholderId || `media_index_${mediaIndex}`,
          is_direct_url: isDirectUrl,
          direct_url: directUrl,
          filename: filename,
          mime_type: mimeType,
          file_base64: fileBase64,
        }),
      }
    );

    if (uploadRes.status === 401) {
      return NextResponse.json(
        {
          error: "DRIVE_AUTH_ERROR",
          message: "Google Drive OAuth token expired or invalid in n8n.",
        },
        { status: 401 }
      );
    }

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      if (errText.includes("DRIVE_AUTH_ERROR")) {
        return NextResponse.json(
          {
            error: "DRIVE_AUTH_ERROR",
            message: "Google Drive OAuth token expired or invalid in n8n.",
          },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Media upload failed: ${errText}` },
        { status: 502 }
      );
    }

    const uploadResult = (await uploadRes.json()) as {
      driveFileId?: string;
      driveUrl?: string;
      direct_url?: string;
    };

    // Update the articles table in Supabase
    const supabase = getSupabaseAdmin();
    const { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("media_instructions")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const instructions: ArticleMediaInstruction[] =
      article?.media_instructions || [];

    const targetIndex = instructions.findIndex(
      (m) =>
        (placeholderId && m.placeholder_id === placeholderId) ||
        (mediaIndex !== undefined && m.index === mediaIndex)
    );

    const now = new Date().toISOString();
    let updatedInstruction: ArticleMediaInstruction;

    if (targetIndex >= 0) {
      updatedInstruction = {
        ...instructions[targetIndex],
        uploaded: true,
        drive_file_id: uploadResult.driveFileId || instructions[targetIndex].drive_file_id,
        drive_url: uploadResult.driveUrl || instructions[targetIndex].drive_url,
        direct_url: isDirectUrl ? directUrl : instructions[targetIndex].direct_url,
        uploaded_at: now,
      };
      instructions[targetIndex] = updatedInstruction;
    } else {
      updatedInstruction = {
        index: mediaIndex ?? instructions.length + 1,
        placeholder_id: placeholderId || `media_index_${instructions.length + 1}`,
        title: filename || "Uploaded Media",
        uploaded: true,
        drive_file_id: uploadResult.driveFileId,
        drive_url: uploadResult.driveUrl,
        direct_url: isDirectUrl ? directUrl : undefined,
        uploaded_at: now,
      };
      instructions.push(updatedInstruction);
    }

    const { data, error } = await supabase
      .from("articles")
      .update({ media_instructions: instructions, updated_at: now })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      article: data,
      instruction: updatedInstruction,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
