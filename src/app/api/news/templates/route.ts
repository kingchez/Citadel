import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** The Canva scene templates the planner and the plan editor can use. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("canva_templates").select("*").order("duration_seconds", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
