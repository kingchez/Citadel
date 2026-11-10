import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view");
    const channel = searchParams.get("channel");

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("articles")
      .select("*")
      .order("created_at", { ascending: false });

    if (view === "review") {
      query = query.eq("status", "review_ready");
    } else if (view === "revisions") {
      query = query.eq("status", "revision_requested");
    } else if (view === "published") {
      query = query.eq("status", "published");
    }

    if (channel && channel !== "all") {
      query = query.eq("channel", channel);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ articles: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("articles")
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ article: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
