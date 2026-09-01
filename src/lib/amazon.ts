/**
 * Extracts an Amazon ASIN from a single line of input, which might be:
 * - a bare ASIN typed directly ("B0BXYZ1234")
 * - a full product URL in any of Amazon's common shapes
 *   (/dp/ASIN, /gp/product/ASIN, /product/ASIN, ?asin=ASIN)
 * Returns null if nothing recognizable was found - callers decide whether
 * that's worth surfacing as "couldn't read this one" to the person.
 */
export function extractAsin(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Bare ASIN: exactly 10 alphanumeric characters, nothing else.
  if (/^[A-Z0-9]{10}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const patterns = [/\/dp\/([A-Z0-9]{10})/i, /\/gp\/product\/([A-Z0-9]{10})/i, /\/product\/([A-Z0-9]{10})/i, /[?&]asin=([A-Z0-9]{10})/i];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].toUpperCase();
  }

  return null;
}

/**
 * Splits pasted input into individual candidate lines - people might
 * separate multiple URLs with newlines, commas, or both.
 */
export function splitProductInput(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolves a shortened Amazon link (amzn.to, a.co, etc.) by following
 * redirects server-side, then re-extracts the ASIN from wherever it lands.
 * Browsers can't do this themselves (CORS), so this only works because
 * it's called from an API route, not client-side code.
 */
export async function resolveShortAmazonLink(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    return extractAsin(res.url);
  } catch {
    return null;
  }
}

export function buildAmazonProductUrl(asin: string): string {
  return `https://www.amazon.com/dp/${asin}`;
}
