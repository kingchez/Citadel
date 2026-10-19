import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { aiConfigured, chatJson } from "@/lib/ai";
import { classify, rankTitles, type MatchStatus } from "@/lib/product-text";
import { cleanAmazonUrl, loadCatalog, resolveCatalogRow, syncSite, type CatalogRow, type ProductSite } from "@/lib/product-sites";
import type { MatchAi, MatchCandidate, MatchResponse } from "@/lib/product-finder-types";

export const maxDuration = 60;

const AI_SYSTEM = `You check whether store listings are the same product as a product named in a short video's script.
Return ONLY a JSON object: {"choice": "<listing id>" or null, "confidence": "high" | "medium" | "low", "reason": "<one short sentence>"}

Rules:
- Choose ONLY from the listing ids you are given. Never invent an id.
- Ignore punctuation, casing, word order and extra marketing words in listing titles.
- If two or more listings are plausible but differ in pack size, quantity, colour, size, model/generation or bundle, and the script name does not say which, return choice null, confidence "low", and say what differs.
- If none of the listings is the same kind of product, return choice null.
- Use "high" only when one listing clearly is the named product and nothing else fits as well.`;

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

async function askAi(name: string, mention: string, listings: { id: string; title: string }[]): Promise<MatchAi> {
  const raw = (await chatJson(AI_SYSTEM, JSON.stringify({ script_name: name, script_context: mention || undefined, listings }))) as {
    choice?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };
  const ids = new Set(listings.map((l) => l.id));
  const choice = typeof raw.choice === "string" && ids.has(raw.choice) ? raw.choice : null; // a made-up id becomes "no choice"
  const confidence = raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "low";
  return { choice, confidence: choice ? confidence : "low", reason: typeof raw.reason === "string" ? raw.reason.slice(0, 300) : "" };
}

/**
 * Finds one script product in the stored catalogs of the chosen sites.
 *  - ranks every listing against the name (punctuation-insensitive, spelling-tolerant)
 *  - exact / likely: no AI needed. ambiguous: the AI cleanup picks one or says it can't.
 *  - resolves the Amazon link of the top few candidates (never loading amazon.com itself)
 * `manual: true` is the typed search box on a card: looser threshold, more results, no AI.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const mention = typeof body?.mention === "string" ? body.mention : "";
    const manual = body?.manual === true;
    const siteIds: string[] | null = Array.isArray(body?.site_ids) ? body.site_ids.filter((x: unknown): x is string => typeof x === "string") : null;
    if (!name) return NextResponse.json({ error: "Nothing to search for." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    let q = supabase.from("product_sites").select("*").eq("enabled", true);
    if (siteIds && siteIds.length > 0) q = q.in("id", siteIds);
    const { data: sitesData, error: sitesError } = await q;
    if (sitesError) return NextResponse.json({ error: sitesError.message }, { status: 500 });
    const sites = (sitesData || []) as ProductSite[];
    if (sites.length === 0) return NextResponse.json({ error: "No product sites selected. Add a site first." }, { status: 400 });

    // A site that has never been read is read now, once; after that its stored catalog is used (refresh it from the site manager).
    const warnings: string[] = [];
    const unsynced = sites.filter((s) => !s.last_synced_at);
    if (unsynced.length > 0) {
      const results = await Promise.all(unsynced.map((s) => syncSite(s)));
      results.forEach((r, i) => {
        if (r.error) warnings.push(`${unsynced[i].label}: ${r.error}`);
      });
    }

    const rows = await loadCatalog(sites.map((s) => s.id));
    const ranked = rankTitles(name, rows, manual ? 12 : 8, manual ? 0.35 : 0.5);
    const status: MatchStatus = manual ? (ranked.length ? "ambiguous" : "none") : classify(ranked);

    let ai: MatchAi | null = null;
    let aiError: string | undefined;
    if (!manual && status === "ambiguous" && ranked.length > 0) {
      if (!aiConfigured()) aiError = "AI cleanup isn't configured, so these need a manual pick.";
      else {
        try {
          ai = await askAi(name, mention, ranked.map((r) => ({ id: r.item.id, title: r.item.title })));
        } catch (err) {
          aiError = err instanceof Error ? err.message : "AI cleanup failed.";
        }
      }
    }

    // Resolve Amazon links: the AI's pick first, then by score. The rest of the list keeps its site link only.
    const order = [...ranked].sort((a, b) => (b.item.id === ai?.choice ? 1 : 0) - (a.item.id === ai?.choice ? 1 : 0));
    const toResolve = new Set(order.slice(0, 4).map((r) => r.item.id));
    const resolved = await Promise.all(
      ranked.map(async (r) => {
        const row = r.item as CatalogRow & { site_label: string };
        if (!toResolve.has(row.id)) return { row, asin: row.asin, url: row.amazon_url, error: undefined as string | undefined, score: r.score };
        const res = await withTimeout(resolveCatalogRow(row), 20000, { asin: null, url: null, error: "Timed out following the site's link." });
        return { row, asin: res.asin, url: res.url, error: res.error, score: r.score };
      })
    );

    // Same Amazon product listed on two sites = one candidate that remembers both sites.
    const byAsin = new Map<string, MatchCandidate>();
    const byRowId = new Map<string, MatchCandidate>();
    const candidates: MatchCandidate[] = [];
    for (const r of resolved) {
      const existing = r.asin ? byAsin.get(r.asin) : undefined;
      if (existing) {
        if (!existing.sites.includes(r.row.site_label)) existing.sites.push(r.row.site_label);
        byRowId.set(r.row.id, existing);
        continue;
      }
      const c: MatchCandidate = {
        key: r.row.id,
        title: r.row.title,
        site_label: r.row.site_label,
        sites: [r.row.site_label],
        score: Math.round(r.score * 100) / 100,
        href: r.row.href,
        asin: r.asin,
        amazon_url: r.url,
        clean_url: r.asin ? cleanAmazonUrl(r.asin) : null,
        ...(r.error ? { resolve_error: r.error } : {}),
      };
      if (r.asin) byAsin.set(r.asin, c);
      byRowId.set(r.row.id, c);
      candidates.push(c);
    }

    // Pre-select only what's safe: the AI's pick when it's at least "medium", or the best match when it was exact/likely.
    let suggested: string | null = null;
    const aiPick = ai?.choice && ai.confidence !== "low" ? byRowId.get(ai.choice) : undefined;
    if (aiPick) suggested = aiPick.key;
    else if ((status === "exact" || status === "likely") && candidates[0]) suggested = candidates[0].key;

    const response: MatchResponse = { status, candidates, suggested, ai, ...(aiError ? { ai_error: aiError } : {}), catalog_size: rows.length, warnings };
    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
