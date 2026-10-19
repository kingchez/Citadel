import * as cheerio from "cheerio";
import type { Element } from "domhandler";
import { getSupabaseAdmin } from "@/lib/supabase";
import { extractAsin, buildAmazonProductUrl } from "@/lib/amazon";
import { normalizeName } from "@/lib/product-text";

/** A website that lists products for a channel (table product_sites). */
export interface ProductSite {
  id: string;
  source_channel_id: string | null;
  label: string;
  url: string;
  mode: "html" | "json";
  item_selector: string | null;
  page_pattern: string | null;
  enabled: boolean;
  product_count: number;
  last_synced_at: string | null;
  last_sync_error: string | null;
  created_at: string;
}

/** One product as listed on a site (table product_catalog). */
export interface CatalogRow {
  id: string;
  site_id: string;
  title: string;
  norm_title: string;
  href: string;
  amazon_url: string | null;
  asin: string | null;
}

interface ScrapedItem {
  title: string;
  href: string;
}

const MAX_PAGES = 30;
const MAX_ITEMS = 5000;
const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---------------------------------------------------------------------------------------------------------------
// Safety + fetching
// ---------------------------------------------------------------------------------------------------------------

/** Basic guard so the server never fetches localhost / private-network addresses on someone's say-so. */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That isn't a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) links are supported.");
  const h = url.hostname.toLowerCase();
  const privateHost =
    h === "localhost" ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h === "[::1]" ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  if (privateHost) throw new Error("That address isn't allowed.");
  return url;
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  return fetch(url, {
    ...rest,
    headers: { "User-Agent": BROWSER_UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9", ...(rest.headers || {}) },
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Amazon link helpers
// ---------------------------------------------------------------------------------------------------------------

const AMAZON_FULL_HOST = /(^|\.)amazon\.[a-z.]{2,}$/i;
const AMAZON_SHORT_HOSTS = new Set(["amzn.to", "a.co", "amzn.com", "amzn.eu", "amzn.asia", "www.amzn.to"]);

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
export const isAmazonFullHost = (url: string) => AMAZON_FULL_HOST.test(hostOf(url));
export const isAmazonAnyHost = (url: string) => isAmazonFullHost(url) || AMAZON_SHORT_HOSTS.has(hostOf(url));

/** First Amazon-looking link inside a page body (anchor, meta refresh, or a JS redirect). */
function findAmazonLinkInHtml(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  const candidates: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) candidates.push(href);
  });
  const meta = $('meta[http-equiv="refresh" i]').attr("content");
  if (meta) {
    const m = meta.match(/url\s*=\s*['"]?([^'"]+)/i);
    if (m) candidates.unshift(m[1]);
  }
  const jsRedirect = html.match(/(?:window\.)?location(?:\.href)?\s*(?:=|\.replace\(|\.assign\()\s*['"]([^'"]+)['"]/i);
  if (jsRedirect) candidates.unshift(jsRedirect[1]);
  for (const c of candidates) {
    try {
      const abs = new URL(c, baseUrl).toString();
      if (isAmazonAnyHost(abs)) return abs;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export interface ResolvedAmazon {
  asin: string | null;
  /** The full Amazon URL the link ended up at (as seen, before it gets cleaned to /dp/ASIN). */
  url: string | null;
  error?: string;
}

/**
 * Follows a site's product link until it reaches an Amazon product URL, WITHOUT ever loading amazon.com
 * (Amazon blocks bots; the redirect target is all we need). Handles: the link being Amazon already, short
 * links (amzn.to / a.co - the Location header is enough), the site's own redirect links (301/302), a
 * meta-refresh / JS redirect, and a site product page with a "Buy on Amazon" link.
 */
export async function resolveToAmazon(startUrl: string): Promise<ResolvedAmazon> {
  let current = startUrl;
  try {
    for (let hop = 0; hop < 7; hop++) {
      if (isAmazonFullHost(current)) {
        const asin = extractAsin(current);
        return asin ? { asin, url: current } : { asin: null, url: current, error: "Amazon link without a product ASIN." };
      }
      assertPublicHttpUrl(current);
      const res = await fetchWithTimeout(current, { redirect: "manual", timeoutMs: 8000 });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        current = new URL(location, current).toString();
        continue;
      }
      if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
        const found = findAmazonLinkInHtml(await res.text(), current);
        if (found) {
          current = found;
          continue;
        }
      }
      return { asin: null, url: null, error: `Couldn't reach an Amazon link (stopped at ${hostOf(current)}, status ${res.status}).` };
    }
    return { asin: null, url: null, error: "Too many redirects." };
  } catch (err) {
    return { asin: null, url: null, error: err instanceof Error ? err.message : "Couldn't resolve the link." };
  }
}

/** Resolves one catalog row and remembers the answer on the row, so the next lookup is instant. */
export async function resolveCatalogRow(row: CatalogRow): Promise<ResolvedAmazon> {
  if (row.asin && row.amazon_url) return { asin: row.asin, url: row.amazon_url };
  const resolved = await resolveToAmazon(row.href);
  if (resolved.asin && resolved.url) {
    await getSupabaseAdmin().from("product_catalog").update({ asin: resolved.asin, amazon_url: resolved.url }).eq("id", row.id);
  }
  return resolved;
}

export const cleanAmazonUrl = buildAmazonProductUrl;

// ---------------------------------------------------------------------------------------------------------------
// Parsing a site's product list
// ---------------------------------------------------------------------------------------------------------------

const GENERIC_CTA = /^(buy|shop|view|get|see|check|order|visit|grab|click|link|here|amazon|more|details|go|learn)\b/i;

function cleanText(s: string | undefined | null): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

function isSkippableHref(href: string): boolean {
  return !href || href.startsWith("#") || /^(mailto:|tel:|javascript:|sms:|whatsapp:)/i.test(href);
}

/** The product's name for a link: its own text, else image alt/title, else the nearest heading in the card around it. */
function titleFor($: cheerio.CheerioAPI, el: Element): string {
  const a = $(el);
  let text = cleanText(a.text());
  if (!text || (text.length <= 28 && GENERIC_CTA.test(text))) {
    const alt = cleanText(a.find("img").first().attr("alt")) || cleanText(a.attr("title")) || cleanText(a.attr("aria-label"));
    if (alt && !GENERIC_CTA.test(alt)) text = alt;
    else {
      let node = a.parent();
      for (let depth = 0; depth < 4 && node.length; depth++) {
        const heading = cleanText(node.find("h1,h2,h3,h4,h5,h6,[class*='title' i],[class*='name' i]").first().text());
        if (heading) {
          text = heading;
          break;
        }
        node = node.parent();
      }
    }
  }
  return text.slice(0, 300);
}

function shapeKey(abs: string): string {
  try {
    const u = new URL(abs);
    if (isAmazonAnyHost(abs)) return "amazon";
    return `${u.hostname}/${u.pathname.split("/").filter(Boolean)[0] ?? ""}`;
  } catch {
    return "?";
  }
}

export function parseHtmlItems(html: string, baseUrl: string, selector?: string | null): ScrapedItem[] {
  const $ = cheerio.load(html);
  const out: ScrapedItem[] = [];
  const push = (el: Element, forcedHref?: string) => {
    const href = forcedHref ?? $(el).attr("href");
    if (!href || isSkippableHref(href)) return;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const title = titleFor($, el);
    if (title.length < 3) return;
    out.push({ title, href: abs });
  };

  if (selector && selector.trim()) {
    $(selector.trim()).each((_, el) => {
      if (el.type !== "tag") return;
      if (el.tagName === "a") push(el);
      else {
        const link = $(el).find("a[href]").first();
        if (link.length) push(link.get(0) as Element);
      }
    });
    return dedupeItems(out);
  }

  // Automatic mode: ignore menus and footers, then find the repeated link pattern.
  const groups = new Map<string, { el: Element; abs: string }[]>();
  $("a[href]").each((_, el) => {
    if ($(el).closest("nav, header, footer, [role='navigation']").length) return;
    const href = $(el).attr("href") || "";
    if (isSkippableHref(href)) return;
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const key = shapeKey(abs);
    const list = groups.get(key) ?? [];
    list.push({ el, abs });
    groups.set(key, list);
  });

  const amazon = groups.get("amazon") ?? [];
  let chosen = amazon;
  if (amazon.length < 3) {
    const biggest = [...groups.entries()].filter(([k]) => k !== "amazon").sort((a, b) => b[1].length - a[1].length)[0];
    // Same host as the site only - a big group of outbound social links shouldn't pass as products.
    chosen = biggest && biggest[1].length >= 5 ? biggest[1] : amazon;
  }
  for (const { el, abs } of chosen) push(el, abs);
  return dedupeItems(out);
}

function dedupeItems(items: ScrapedItem[]): ScrapedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.href}\u0000${i.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const TITLE_KEYS = ["title", "name", "product_name", "productName", "product", "label", "heading"];
const URL_KEYS = ["amazon_url", "amazonUrl", "affiliate_url", "affiliateUrl", "url", "link", "href", "permalink", "buy_url", "buyUrl"];

/** JSON mode: finds the biggest array of objects anywhere in the response and guesses which keys are the name and the link. */
export function parseJsonItems(data: unknown, baseUrl: string): ScrapedItem[] {
  let best: Record<string, unknown>[] = [];
  const queue: { v: unknown; d: number }[] = [{ v: data, d: 0 }];
  while (queue.length) {
    const { v, d } = queue.shift()!;
    if (Array.isArray(v)) {
      const objs = v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x));
      if (objs.length > best.length && objs.length >= v.length / 2) best = objs;
      if (d < 5) for (const x of v.slice(0, 50)) queue.push({ v: x, d: d + 1 });
    } else if (v && typeof v === "object" && d < 5) {
      for (const x of Object.values(v)) queue.push({ v: x, d: d + 1 });
    }
  }
  if (best.length === 0) return [];

  const sample = best.slice(0, 20);
  const pickKey = (keys: string[], test: (val: unknown) => boolean) => keys.find((k) => sample.some((o) => test(o[k])));
  const isStr = (v: unknown) => typeof v === "string" && v.trim().length > 2;
  const looksUrl = (v: unknown) => typeof v === "string" && /^(https?:)?\/\//i.test(v.trim());
  const titleKey = pickKey(TITLE_KEYS, isStr);
  let urlKey = pickKey(URL_KEYS, looksUrl);
  if (!urlKey) {
    const keys = new Set(sample.flatMap((o) => Object.keys(o)));
    urlKey = [...keys].find((k) => sample.some((o) => looksUrl(o[k]) && isAmazonAnyHost(String(o[k]))));
  }
  if (!titleKey || !urlKey) return [];

  const out: ScrapedItem[] = [];
  for (const o of best) {
    const title = cleanText(String(o[titleKey] ?? ""));
    const href = String(o[urlKey] ?? "").trim();
    if (title.length < 3 || !href) continue;
    try {
      out.push({ title, href: new URL(href, baseUrl).toString() });
    } catch {
      /* skip */
    }
  }
  return dedupeItems(out);
}

// ---------------------------------------------------------------------------------------------------------------
// Fetch + store a whole site
// ---------------------------------------------------------------------------------------------------------------

async function fetchPageItems(site: Pick<ProductSite, "mode" | "item_selector">, url: string): Promise<ScrapedItem[]> {
  assertPublicHttpUrl(url);
  const res = await fetchWithTimeout(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`The site answered ${res.status} for ${url}.`);
  const type = res.headers.get("content-type") || "";
  const body = await res.text();
  if (site.mode === "json" || type.includes("json")) {
    try {
      return parseJsonItems(JSON.parse(body), url);
    } catch {
      throw new Error("Expected JSON from that link but couldn't read it.");
    }
  }
  return parseHtmlItems(body, url, site.item_selector);
}

/** Every product the site lists. With a page pattern like https://site.com/products?page={n}, walks pages until one adds nothing new. */
export async function scrapeSite(site: Pick<ProductSite, "url" | "mode" | "item_selector" | "page_pattern">): Promise<ScrapedItem[]> {
  const all = new Map<string, ScrapedItem>();
  const addAll = (items: ScrapedItem[]) => {
    let added = 0;
    for (const i of items) {
      const key = `${i.href}\u0000${i.title}`;
      if (!all.has(key)) {
        all.set(key, i);
        added++;
      }
    }
    return added;
  };

  if (!site.page_pattern || !site.page_pattern.includes("{n}")) {
    addAll(await fetchPageItems(site, site.url));
    return [...all.values()].slice(0, MAX_ITEMS);
  }
  for (let n = 1; n <= MAX_PAGES; n++) {
    const url = site.page_pattern.replace("{n}", String(n));
    let items: ScrapedItem[];
    try {
      items = await fetchPageItems(site, url);
    } catch (err) {
      if (n === 1) throw err; // first page failing is a real error; a later 404 just means "no more pages"
      break;
    }
    if (addAll(items) === 0 || all.size >= MAX_ITEMS) break;
  }
  return [...all.values()].slice(0, MAX_ITEMS);
}

export interface SyncResult {
  count: number;
  sample: string[];
  error?: string;
}

/** Re-reads a site and replaces its stored catalog. If the read fails or finds nothing, the old catalog is kept. */
export async function syncSite(site: ProductSite): Promise<SyncResult> {
  const supabase = getSupabaseAdmin();
  const fail = async (message: string): Promise<SyncResult> => {
    await supabase.from("product_sites").update({ last_sync_error: message, last_synced_at: new Date().toISOString() }).eq("id", site.id);
    return { count: 0, sample: [], error: message };
  };

  let items: ScrapedItem[];
  try {
    items = await scrapeSite(site);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Couldn't read the site.");
  }
  if (items.length === 0) {
    return fail(
      site.mode === "json"
        ? "No products found in that JSON. Check the link points at the product data."
        : "No products found on that page. The list is probably built by JavaScript after the page loads - open the site's DevTools > Network > Fetch/XHR, reload, and use the JSON link as this site's link with mode JSON. Or set an item selector."
    );
  }

  const rows = items.map((i) => {
    const direct = isAmazonFullHost(i.href) ? extractAsin(i.href) : null;
    return {
      site_id: site.id,
      title: i.title,
      norm_title: normalizeName(i.title),
      href: i.href,
      amazon_url: direct ? i.href : null,
      asin: direct,
    };
  });

  const del = await supabase.from("product_catalog").delete().eq("site_id", site.id);
  if (del.error) return fail(del.error.message);
  for (let i = 0; i < rows.length; i += 500) {
    const ins = await supabase.from("product_catalog").upsert(rows.slice(i, i + 500), { onConflict: "site_id,href,title", ignoreDuplicates: true });
    if (ins.error) return fail(ins.error.message);
  }
  await supabase
    .from("product_sites")
    .update({ product_count: rows.length, last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq("id", site.id);
  return { count: rows.length, sample: items.slice(0, 5).map((i) => i.title) };
}

/** Every catalog row of the given sites (Supabase returns max 1000 rows per request, so this pages). */
export async function loadCatalog(siteIds: string[]): Promise<(CatalogRow & { site_label: string })[]> {
  if (siteIds.length === 0) return [];
  const supabase = getSupabaseAdmin();
  const sites = await supabase.from("product_sites").select("id, label").in("id", siteIds);
  if (sites.error) throw new Error(sites.error.message);
  const labels = new Map((sites.data || []).map((s: { id: string; label: string }) => [s.id, s.label]));

  const rows: (CatalogRow & { site_label: string })[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("product_catalog")
      .select("id, site_id, title, norm_title, href, amazon_url, asin")
      .in("site_id", siteIds)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const r of (data || []) as CatalogRow[]) rows.push({ ...r, site_label: labels.get(r.site_id) ?? "" });
    if (!data || data.length < 1000) break;
  }
  return rows;
}
