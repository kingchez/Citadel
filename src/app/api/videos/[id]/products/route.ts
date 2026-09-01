import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProductEntry } from "@/lib/types";

/**
 * Replaces the whole product list - covers editing an ASIN in place,
 * removing one or more products, and clearing everything (send an empty
 * array). with_product is always recomputed from the resulting length,
 * never set independently, so the affiliate tag can never drift out of
 * sync with whether there are actually any products.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const products: unknown = body?.products;

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "products must be an array." }, { status: 400 });
    }

    const cleaned: ProductEntry[] = products.map((p: Partial<ProductEntry>, i: number) => ({
      index: i,
      asin: String(p.asin || "").trim().toUpperCase(),
      source_url: p.source_url,
      added_at: p.added_at || new Date().toISOString(),
    }));

    if (cleaned.some((p) => !p.asin)) {
      return NextResponse.json({ error: "Every product needs a non-empty ASIN." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("videos")
      .update({ product_ids: cleaned, with_product: cleaned.length > 0 })
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
