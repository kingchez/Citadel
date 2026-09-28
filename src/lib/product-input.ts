import { extractAsin, splitProductInput, resolveShortAmazonLink } from "./amazon";
import type { ProductEntry } from "./types";

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/**
 * Turns pasted product URLs/ASINs into the same ProductEntry shape the
 * existing "add products" route produces. Nothing is silently dropped:
 * lines that can't be read come back in `failed` so the caller can refuse
 * the whole request instead of saving a partial list.
 */
export async function parseProductInput(raw: string | undefined | null): Promise<{
  products: ProductEntry[];
  failed: string[];
}> {
  const lines = splitProductInput(raw ?? "");
  const seen = new Set<string>();
  const products: ProductEntry[] = [];
  const failed: string[] = [];

  for (const line of lines) {
    let asin = extractAsin(line);
    if (!asin && /^https?:\/\//i.test(line)) {
      asin = await withTimeout(resolveShortAmazonLink(line), 8000, null);
    }
    if (!asin) {
      failed.push(line);
      continue;
    }
    if (seen.has(asin)) continue;
    seen.add(asin);
    products.push({ index: products.length, asin, source_url: line, added_at: new Date().toISOString() });
  }

  return { products, failed };
}
