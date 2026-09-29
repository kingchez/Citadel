import { NextRequest } from "next/server";
// The SAME handler the videos page's "add products" box calls - imported and
// invoked directly so this path can never drift from it (ASIN extraction,
// short-link resolving, de-duplication, index numbering, and with_product
// being recomputed from the resulting list all come from that one place).
import { POST as addProductsHandler } from "@/app/api/videos/[id]/products/add/route";

export interface AddProductsResult {
  added: number;
  skippedDuplicates: number;
  /** Lines the product logic couldn't read - the valid ones were still added. */
  failed: string[];
  /** Set only if the whole product step failed (video itself already exists). */
  error?: string;
}

export async function addProductsToVideo(videoId: string, rawInput: unknown): Promise<AddProductsResult | null> {
  if (typeof rawInput !== "string" || !rawInput.trim()) return null; // nothing pasted, nothing to do

  try {
    const req = new NextRequest(`http://internal/api/videos/${videoId}/products/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: rawInput }),
    });
    const res = await addProductsHandler(req, { params: Promise.resolve({ id: videoId }) });
    const data = await res.json();
    if (!res.ok) return { added: 0, skippedDuplicates: 0, failed: [], error: data.error || "Couldn't add products." };
    return { added: data.added ?? 0, skippedDuplicates: data.skippedDuplicates ?? 0, failed: data.failed ?? [] };
  } catch (err) {
    return { added: 0, skippedDuplicates: 0, failed: [], error: err instanceof Error ? err.message : "Couldn't add products." };
  }
}
