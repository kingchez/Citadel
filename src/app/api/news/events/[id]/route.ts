import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").select("*").eq("id", id).single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
    }

    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/** Direct field updates (headline, summary, article, thumbnail, status) -
 * pure database write, whatever's in the body is what gets set. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    if (body.status === "reviewed") {
      const supabase = getSupabaseAdmin();
      const { data: current } = await supabase.from("events").select("thumbnail").eq("id", id).single();
      if (!current?.thumbnail && !body.thumbnail) {
        return NextResponse.json({ error: "Select a thumbnail before marking as reviewed." }, { status: 400 });
      }
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("events").update(body).eq("id", id).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
