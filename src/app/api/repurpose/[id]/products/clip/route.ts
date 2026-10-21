import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { statusAfterProductChange } from "@/lib/product-items";
import type { ProductEntry } from "@/lib/types";

/**
 * Per-product clip actions on a repurpose item:
 *  retry - an errored clip goes back to pending;   skip - no clip for this product (it is created without a video);
 *  recut - a finished clip is cut again from new start/end times (set them on the Products page first).
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const asin = String(body?.asin || "").trim().toUpperCase();
    const action: string = body?.action;
    if (!asin || !["retry", "skip", "recut"].includes(action)) {
      return NextResponse.json({ error: "Send { asin, action: retry | skip | recut }." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: row, error } = await supabase
      .from("repurpose_videos")
      .select("video_id, products_step, video:videos!repurpose_videos_video_id_fkey(product_ids, Products_Processing_Status)")
      .eq("id", id)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row?.video_id) return NextResponse.json({ error: "Repurpose item not found." }, { status: 404 });

    const video = (Array.isArray(row.video) ? row.video[0] : row.video) as { product_ids: ProductEntry[] | null; Products_Processing_Status: string | null } | null;
    const items: ProductEntry[] = Array.isArray(video?.product_ids) ? video!.product_ids! : [];
    const target = items.find((p) => String(p.asin).toUpperCase() === asin);
    if (!target) return NextResponse.json({ error: `${asin} is not in this video's product list.` }, { status: 404 });

    const next = items.map((p) => ({ ...p }));
    const t = next.find((p) => String(p.asin).toUpperCase() === asin)!;
    if (action === "retry") {
      if (t.clip !== "error") return NextResponse.json({ error: "Only a failed clip can be retried." }, { status: 409 });
      t.clip = "pending";
      t.clip_error = null;
    } else if (action === "skip") {
      if (t.clip !== "error" && t.clip !== "pending") return NextResponse.json({ error: "Only a pending or failed clip can be skipped." }, { status: 409 });
      t.clip = "none";
      t.clip_error = null;
    } else {
      if (t.clip !== "done") return NextResponse.json({ error: "Only a finished clip can be cut again." }, { status: 409 });
      if (typeof t.video_index !== "number" || typeof t.start !== "number" || typeof t.end !== "number") {
        return NextResponse.json({ error: "This product has no footage window to cut from." }, { status: 409 });
      }
      t.clip = "pending";
      t.clip_error = null;
    }

    const status = statusAfterProductChange(video?.Products_Processing_Status ?? null, false, next, row.products_step !== "confirmed");
    const { data: swapped, error: swapError } = await supabase.rpc("save_product_items", {
      p_video_id: row.video_id,
      p_expected: items,
      p_items: next,
      p_status: status,
    });
    if (swapError) return NextResponse.json({ error: swapError.message }, { status: 500 });
    if (swapped !== true) return NextResponse.json({ error: "The product list just changed - reload and try again." }, { status: 409 });
    return NextResponse.json({ ok: true, items: next, shop_status: status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
