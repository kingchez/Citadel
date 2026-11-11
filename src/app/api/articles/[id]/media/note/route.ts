import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
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
    const notes: string = body?.notes || "";

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

    if (targetIndex >= 0) {
      instructions[targetIndex] = {
        ...instructions[targetIndex],
        notes,
      };
    } else if (placeholderId) {
      instructions.push({
        index: mediaIndex ?? instructions.length + 1,
        placeholder_id: placeholderId,
        title: "Media Instruction",
        notes,
      });
    }

    const { data, error } = await supabase
      .from("articles")
      .update({ media_instructions: instructions, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, article: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
