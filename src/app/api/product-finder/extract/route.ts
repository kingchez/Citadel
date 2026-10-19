import { NextRequest, NextResponse } from "next/server";
import { chatJson } from "@/lib/ai";
import { normalizeName } from "@/lib/product-text";
import type { ExtractedProduct } from "@/lib/product-finder-types";

export const maxDuration = 60;

const SYSTEM = `You read the script of a short Amazon product video and list the products it features.
Return ONLY a JSON object: {"products":[{"name":"...","mention":"..."}]}

Rules:
- One entry per distinct product, in the order they appear. No duplicates.
- "name" is how the product would be titled in a store: brand (if said) + product type + any model/size words that identify it. No hype words ("amazing", "game-changing"), no prices.
- "mention" is a verbatim snippet of at most 12 words from the script where the product is introduced.
- Skip the intro, outro, calls to action, sponsor reads and anything that is not a product being shown.
- If the script numbers its products (Number 1, #2, "first", "next"), use that to keep the order, but do not put the number in the name.
- If you are unsure whether something is a product, leave it out.`;

/** Turns a pasted script into a clean ordered list of product names. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const script = typeof body?.script === "string" ? body.script.trim() : "";
    if (script.length < 20) return NextResponse.json({ error: "Paste the full script first." }, { status: 400 });

    const data = (await chatJson(SYSTEM, script.slice(0, 30000))) as { products?: unknown };
    const raw = Array.isArray(data?.products) ? data.products : [];
    const seen = new Set<string>();
    const products: ExtractedProduct[] = [];
    for (const p of raw as { name?: unknown; mention?: unknown }[]) {
      const name = typeof p?.name === "string" ? p.name.trim().slice(0, 200) : "";
      const key = normalizeName(name);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      products.push({ name, mention: typeof p?.mention === "string" ? p.mention.trim().slice(0, 200) : "" });
      if (products.length >= 60) break;
    }
    if (products.length === 0) return NextResponse.json({ error: "No products found in that script." }, { status: 422 });
    return NextResponse.json({ products });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
