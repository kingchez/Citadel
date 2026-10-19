import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { syncSite, type ProductSite } from "@/lib/product-sites";

export const maxDuration = 60;

/** (Re)reads the site's product list and stores it. Doubles as the "Test" button: returns how many products were found and a few examples. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { data, error } = await getSupabaseAdmin().from("product_sites").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: error?.message || "Site not found." }, { status: 404 });
    const result = await syncSite(data as ProductSite);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
