import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { buildAmazonProductUrl, extractAsin, resolveShortAmazonLink } from "@/lib/amazon";
import { applyShopInfo, lookupShopProducts, statusAfterProductChange } from "@/lib/product-items";
import type { ProductEntry } from "@/lib/types";

const STAGE_STATUSES = ["voice_timing_done", "handed_off"];
const MAX_CLIP_SECONDS = 300; // same ceiling the render server enforces
const MIN_GAP_OVERLAP = 1; // seconds of overlap between two products' windows we tolerate

interface LoadedRow {
  id: string;
  title: string;
  status: string;
  products_step: string | null;
  sources: Array<{ index: number; url?: string; original_url?: string; kind?: string; timing?: string }>;
  voice_timing: unknown;
  product_candidates: unknown;
  video_id: string | null;
  video: { product_ids: ProductEntry[] | null; Products_Processing_Status: string | null } | null;
}

async function loadRow(id: string): Promise<LoadedRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("repurpose_videos")
    .select(
      "id, title, status, products_step, sources, voice_timing, product_candidates, video_id, video:videos!repurpose_videos_video_id_fkey(product_ids, Products_Processing_Status)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const video = Array.isArray(data.video) ? data.video[0] : data.video;
  return { ...(data as unknown as LoadedRow), video: (video as LoadedRow["video"]) ?? null };
}

/** Everything the Products page needs to review one item: its videos (with sound), the transcript, the products. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await loadRow(id);
    if (!row) return NextResponse.json({ error: "Repurpose item not found." }, { status: 404 });

    const timing = (Array.isArray(row.voice_timing) ? row.voice_timing : []).map(
      (t: { index?: number; segments?: Array<{ start?: number; end?: number; text?: string }>; error?: string }) => ({
        index: t.index,
        error: t.error ?? null,
        segments: (t.segments ?? [])
          .filter((s) => typeof s.start === "number" && typeof s.end === "number")
          .map((s) => ({ start: s.start as number, end: s.end as number, text: String(s.text ?? "").trim().slice(0, 240) })),
      })
    );

    return NextResponse.json({
      id: row.id,
      title: row.title,
      status: row.status,
      products_step: row.products_step,
      shop_status: row.video?.Products_Processing_Status ?? null,
      sources: (row.sources ?? []).map((s) => ({ index: s.index, url: s.url ?? null, original_url: s.original_url ?? null, kind: s.kind ?? null })),
      timing,
      items: Array.isArray(row.video?.product_ids) ? row.video!.product_ids : [],
      candidates: Array.isArray(row.product_candidates) ? row.product_candidates : [],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

interface IncomingItem {
  asin?: string;
  link?: string;
  name?: string;
  video_index?: number | null;
  start?: number | null;
  end?: number | null;
  no_clip?: boolean;
  recut?: boolean;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * action "save"    - keep the work so far (step stays in review, nothing is cut).
 * action "confirm" - lock the products + footage windows in: shop check, clips queued, hand over to the shop pass.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const action: string = body?.action;
    const incoming: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];
    if (action !== "save" && action !== "confirm") {
      return NextResponse.json({ error: 'action must be "save" or "confirm".' }, { status: 400 });
    }

    const row = await loadRow(id);
    if (!row) return NextResponse.json({ error: "Repurpose item not found." }, { status: 404 });
    if (!STAGE_STATUSES.includes(row.status)) {
      return NextResponse.json({ error: `This item is "${row.status}" - products can be set once its voice timing is done.` }, { status: 409 });
    }
    if (!row.video_id) return NextResponse.json({ error: "This item has no linked video row." }, { status: 409 });
    if (action === "confirm" && incoming.length === 0) {
      return NextResponse.json({ error: "Add at least one product before confirming." }, { status: 400 });
    }

    const sourceIndexes = new Set((row.sources ?? []).map((s) => s.index));
    const stored: ProductEntry[] = Array.isArray(row.video?.product_ids) ? row.video!.product_ids! : [];
    const storedByAsin = new Map(stored.map((p) => [String(p.asin).toUpperCase(), p]));
    const problems: string[] = [];

    // 1) read every ASIN
    const resolved: Array<{ asin: string; item: IncomingItem; n: number }> = [];
    for (let i = 0; i < incoming.length; i++) {
      const item = incoming[i];
      const n = i + 1;
      const raw = String(item.asin || item.link || "").trim();
      let asin = raw ? extractAsin(raw) : null;
      if (!asin && /^https?:\/\//i.test(raw)) asin = await resolveShortAmazonLink(raw);
      if (!asin) {
        problems.push(`Product ${n}: couldn't read an ASIN from "${raw || "(empty)"}".`);
        continue;
      }
      resolved.push({ asin, item, n });
    }
    const seen = new Set<string>();
    for (const r of resolved) {
      if (seen.has(r.asin)) problems.push(`Product ${r.n}: ${r.asin} is in the list twice.`);
      seen.add(r.asin);
    }

    // 2) shop check (dedup) - products already in the shop never get a new clip
    const shop = await lookupShopProducts(resolved.map((r) => r.asin));

    // 3) build the items
    const built: ProductEntry[] = [];
    for (const { asin, item, n } of resolved) {
      const old = storedByAsin.get(asin);
      const lockedDone = old?.clip === "done" && !item.recut; // a finished clip is never cut again unless asked
      const vIdx = lockedDone ? (old?.video_index ?? null) : num(item.video_index);
      const start = lockedDone ? (old?.start ?? null) : num(item.start);
      const end = lockedDone ? (old?.end ?? null) : num(item.end);

      if (action === "confirm" || vIdx !== null || start !== null || end !== null) {
        if (vIdx === null || !sourceIndexes.has(vIdx)) problems.push(`Product ${n} (${asin}): choose which video it is in.`);
        else if (start === null || end === null || start < 0 || end <= start) problems.push(`Product ${n} (${asin}): needs a start and an end time, with the end after the start.`);
        else if (end - start > MAX_CLIP_SECONDS) problems.push(`Product ${n} (${asin}): a product window can be at most ${MAX_CLIP_SECONDS} seconds.`);
      }

      let entry: ProductEntry = {
        ...(old ?? {}),
        index: built.length,
        asin,
        source_url: buildAmazonProductUrl(asin),
        added_at: old?.added_at || new Date().toISOString(),
        video_index: vIdx,
        start,
        end,
      };
      const name = String(item.name ?? "").trim();
      if (name) entry.name = name;
      entry = applyShopInfo(entry, shop.get(asin));

      if (action === "confirm") {
        if (entry.clip === "exists" || entry.clip === "done") {
          // keep - already in the shop / already cut
        } else if (item.no_clip) {
          entry.clip = "none";
          entry.clip_error = null;
        } else {
          entry.clip = "pending"; // a new clip is needed (also resets a previous error)
          entry.clip_error = null;
        }
        if (item.recut && old?.clip === "done" && !shop.get(asin)?.postId) {
          entry.clip = "pending";
          entry.clip_error = null;
        }
      }
      built.push(entry);
    }

    // 4) windows of two products in the same video must not overlap
    const byVideo = new Map<number, ProductEntry[]>();
    for (const p of built) {
      if (typeof p.video_index === "number" && typeof p.start === "number" && typeof p.end === "number") {
        byVideo.set(p.video_index, [...(byVideo.get(p.video_index) ?? []), p]);
      }
    }
    for (const [v, list] of byVideo) {
      const sorted = [...list].sort((a, b) => (a.start as number) - (b.start as number));
      for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i].start as number) < (sorted[i - 1].end as number) - MIN_GAP_OVERLAP) {
          problems.push(`Video ${v + 1}: ${sorted[i - 1].asin} and ${sorted[i].asin} overlap - fix their start/end times.`);
        }
      }
    }

    if (problems.length > 0) return NextResponse.json({ error: problems[0], problems }, { status: 400 });

    // 5) write: compare-and-swap on the product list, so a clip that finished meanwhile is never overwritten
    const hadNew = built.some((p) => !storedByAsin.has(p.asin));
    const status = statusAfterProductChange(row.video?.Products_Processing_Status ?? null, hadNew, built, action !== "confirm");
    const supabase = getSupabaseAdmin();
    const { data: swapped, error: swapError } = await supabase.rpc("save_product_items", {
      p_video_id: row.video_id,
      p_expected: Array.isArray(row.video?.product_ids) ? row.video!.product_ids : null,
      p_items: built,
      p_status: status,
    });
    if (swapError) return NextResponse.json({ error: swapError.message }, { status: 500 });
    if (swapped !== true) {
      return NextResponse.json({ error: "The product list changed while you were editing (a clip may have just finished). Reload the page and try again." }, { status: 409 });
    }

    const step = action === "confirm" ? "confirmed" : "review";
    // Once confirmed, the agent's proposals have done their job - clear them so nothing stale is left behind.
    const { error: stepError } = await supabase
      .from("repurpose_videos")
      .update(action === "confirm" ? { products_step: step, product_candidates: null } : { products_step: step })
      .eq("id", id);
    if (stepError) return NextResponse.json({ error: `Products saved, but the step could not be updated: ${stepError.message}. Press the button again.` }, { status: 500 });

    return NextResponse.json({ ok: true, step, items: built, shop_status: status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
