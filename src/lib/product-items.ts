import { getSupabaseAdmin } from "@/lib/supabase";
import type { ProductEntry } from "@/lib/types";

/**
 * Shared rules for the product list on a videos row (videos.product_ids), used by every place that changes it:
 * the videos-page "add products" box, the list editor, the repurpose insert, and the Products page.
 * Keeping them here means a product can never be added in a way that skips the shop check or the status update.
 */

export interface ShopProductInfo {
  postId: string | number | null;
  name: string | null;
  videoName: string | null;
}

/** Looks the ASINs up in the ViralShop Products table (the shop's own record of products it has already created). */
export async function lookupShopProducts(asins: string[]): Promise<Map<string, ShopProductInfo>> {
  const out = new Map<string, ShopProductInfo>();
  const list = [...new Set(asins.map((a) => a.trim().toUpperCase()).filter(Boolean))];
  if (list.length === 0) return out;
  const { data, error } = await getSupabaseAdmin()
    .from("ViralShop Products")
    .select("Product_ASIN, product_post_id, Product_Name, Bucket_VideoName")
    .in("Product_ASIN", list);
  if (error) throw new Error(`Could not check the shop for existing products: ${error.message}`);
  for (const r of data ?? []) {
    out.set(String(r.Product_ASIN).toUpperCase(), {
      postId: r.product_post_id ?? null,
      name: r.Product_Name ?? null,
      videoName: r.Bucket_VideoName ?? null,
    });
  }
  return out;
}

/**
 * Applies what the shop already knows about an ASIN to a product item:
 *  - already created in WooCommerce -> Exist = its post id, clip = "exists" (no new clip, product data attached);
 *  - clip already made but not yet in WooCommerce -> clip = "done" (never cut twice).
 * Footage times on the item are kept either way: the planning agent still needs each product's window.
 */
export function applyShopInfo(entry: ProductEntry, info: ShopProductInfo | undefined): ProductEntry {
  if (!info) return entry;
  const next: ProductEntry = { ...entry };
  if (info.name && !next.name) next.name = info.name;
  if (info.postId) {
    next.Exist = info.postId;
    next.clip = "exists";
    next.clip_error = null;
  } else if (info.videoName) {
    next.clip = "done";
    next.clip_error = null;
  }
  return next;
}

/**
 * Is this video still inside the repurpose "products" step? While it is, the shop pass must not start,
 * because the product clips don't exist yet. Videos that are not repurposed are never gated.
 * (A repurpose row that was already handed off before this feature existed is not gated either.)
 */
/** Only repurposed Viral Shop videos go through the products step (clips + Products page). Every other video simply
 * gets the shop check and goes to WooCommerce, without clips. */
export const PRODUCT_STEP_CHANNEL = "Viral Shop";

export async function isProductStepOpen(videoId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from("repurpose_videos")
    .select("status, products_step, channel")
    .eq("video_id", videoId)
    .maybeSingle();
  if (!data || data.channel !== PRODUCT_STEP_CHANNEL) return false;
  if (data.products_step === "confirmed") return false;
  if (data.products_step == null && data.status === "handed_off") return false;
  return data.status !== "cancelled";
}

/**
 * What videos.Products_Processing_Status should be after the product list changed.
 *   pending         -> the shop pass (n8n) should check / scrape / create the products
 *   awaiting_clips  -> hold: clips are still being made (or the product step isn't confirmed yet)
 * Anything else is left exactly as it was.
 */
export function statusAfterProductChange(
  current: string | null,
  hadNewProducts: boolean,
  items: ProductEntry[],
  stepOpen: boolean
): string | null {
  if (items.length === 0) return current;
  if (stepOpen) return "awaiting_clips";
  if (items.some((p) => p.clip === "pending" || p.clip === "error")) return "awaiting_clips";
  if (current === "awaiting_clips") return "pending"; // everything resolved -> release to the shop pass
  if (hadNewProducts) return "pending"; // a new product must always be seen by the shop pass
  return current;
}

/**
 * A repurposed video whose products were already confirmed, and then gets a NEW product that still needs its
 * footage window (not already in the shop, not already cut), goes back to the Products page: the product step is
 * reopened (review) so the shop pass waits for that product's clip instead of creating it without a video.
 * Returns true when the step was reopened.
 */
export async function reopenStepIfNeeded(videoId: string, newItems: ProductEntry[]): Promise<boolean> {
  if (!newItems.some((p) => !p.clip)) return false;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("repurpose_videos").select("id, products_step, channel").eq("video_id", videoId).maybeSingle();
  if (!data || data.channel !== PRODUCT_STEP_CHANNEL || data.products_step !== "confirmed") return false;
  const { error } = await supabase.from("repurpose_videos").update({ products_step: "review" }).eq("id", data.id);
  return !error;
}
