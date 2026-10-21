import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProductEntry } from "@/lib/types";
import { buildAmazonProductUrl } from "@/lib/amazon";
import { applyShopInfo, isProductStepOpen, lookupShopProducts, statusAfterProductChange } from "@/lib/product-items";

/**
 * Replaces the whole product list - covers editing an ASIN in place,
 * removing one or more products, and clearing everything (send an empty
 * array). with_product is always recomputed from the resulting length,
 * never set independently, so the affiliate tag can never drift out of
 * sync with whether there are actually any products.
 *
 * product_output_url is optional and independent of the product list -
 * pass it whenever it's being edited, omit it to leave it untouched.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const products: unknown = body?.products;
    const hasOutputUrl = Object.prototype.hasOwnProperty.call(body ?? {}, "product_output_url");
    const productOutputUrl: string | null | undefined = body?.product_output_url;

    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "products must be an array." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("videos")
      .select("product_ids, Products_Processing_Status")
      .eq("id", id)
      .single();
    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }
    const stored: ProductEntry[] = Array.isArray(current?.product_ids) ? current.product_ids : [];
    const storedByAsin = new Map(stored.map((p) => [String(p.asin).toUpperCase(), p]));

    // A product that is kept (same ASIN) keeps everything stored on it: name, footage window, clip status, shop
    // check. Only the name can be edited here. A changed ASIN is a NEW product, so it starts clean.
    const cleaned: ProductEntry[] = products.map((p: Partial<ProductEntry>, i: number) => {
      const asin = String(p.asin || "").trim().toUpperCase();
      const kept = storedByAsin.get(asin);
      const entry: ProductEntry = {
        ...(kept ?? {}),
        index: i,
        asin,
        // always the clean link built from the ASIN, so an edited ASIN can never keep a stale/long URL
        source_url: asin ? buildAmazonProductUrl(asin) : p.source_url,
        added_at: kept?.added_at || p.added_at || new Date().toISOString(),
      };
      if (typeof p.name === "string" && p.name.trim()) entry.name = p.name.trim();
      return entry;
    });

    if (cleaned.some((p) => !p.asin)) {
      return NextResponse.json({ error: "Every product needs a non-empty ASIN." }, { status: 400 });
    }
    if (new Set(cleaned.map((p) => p.asin)).size !== cleaned.length) {
      return NextResponse.json({ error: "The same ASIN is in the list twice." }, { status: 400 });
    }

    // New ASINs get the same shop check as everywhere else, and a product list that gained a product goes back
    // to the shop pass.
    const fresh = cleaned.filter((p) => !storedByAsin.has(p.asin));
    const shop = await lookupShopProducts(fresh.map((p) => p.asin));
    for (let i = 0; i < cleaned.length; i++) {
      if (!storedByAsin.has(cleaned[i].asin)) cleaned[i] = applyShopInfo(cleaned[i], shop.get(cleaned[i].asin));
    }
    const currentStatus: string | null = current?.Products_Processing_Status ?? null;
    const nextStatus = statusAfterProductChange(currentStatus, fresh.length > 0, cleaned, await isProductStepOpen(id));

    const updates: Record<string, unknown> = { product_ids: cleaned, with_product: cleaned.length > 0 };
    if (nextStatus !== currentStatus && nextStatus !== null) updates.Products_Processing_Status = nextStatus;
    if (hasOutputUrl) {
      updates.product_output_url = productOutputUrl?.trim() || null;
    }

    const { data, error } = await supabase.from("videos").update(updates).eq("id", id).select().single();

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
