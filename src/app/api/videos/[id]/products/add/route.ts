import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { extractAsin, splitProductInput, resolveShortAmazonLink } from "@/lib/amazon";
import type { ProductEntry } from "@/lib/types";

/**
 * Adds one or more affiliate products from pasted URLs/ASINs (newline or
 * comma separated). Only the extracted ASIN is stored - the pasted URL is
 * kept alongside purely for reference, in case the extraction needs
 * checking later. Pure database write, direct to Supabase.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rawInput: string | undefined = body?.raw_input;

    if (!rawInput || !rawInput.trim()) {
      return NextResponse.json({ error: "Paste at least one product URL or ASIN." }, { status: 400 });
    }

    const lines = splitProductInput(rawInput);
    if (lines.length === 0) {
      return NextResponse.json({ error: "Nothing to add." }, { status: 400 });
    }

    const failed: string[] = [];
    const extractedAsins: { asin: string; source_url: string }[] = [];

    for (const line of lines) {
      let asin = extractAsin(line);
      // Shortened links (amzn.to etc.) don't contain the ASIN directly -
      // only worth the extra network round trip when it looks like a URL
      // we couldn't already read.
      if (!asin && /^https?:\/\//i.test(line)) {
        asin = await resolveShortAmazonLink(line);
      }
      if (asin) {
        extractedAsins.push({ asin, source_url: line });
      } else {
        failed.push(line);
      }
    }

    const supabase = getSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase.from("videos").select("product_ids").eq("id", id).single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existing: ProductEntry[] = video?.product_ids || [];
    const existingAsins = new Set(existing.map((p) => p.asin));
    let nextIndex = existing.length > 0 ? Math.max(...existing.map((p) => p.index)) + 1 : 0;

    const newEntries: ProductEntry[] = [];
    for (const { asin, source_url } of extractedAsins) {
      if (existingAsins.has(asin)) continue; // already have this one
      newEntries.push({ index: nextIndex++, asin, source_url, added_at: new Date().toISOString() });
      existingAsins.add(asin);
    }

    const merged = [...existing, ...newEntries];

    const { data, error } = await supabase
      .from("videos")
      .update({ product_ids: merged, with_product: merged.length > 0 })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      video: data,
      added: newEntries.length,
      skippedDuplicates: extractedAsins.length - newEntries.length,
      failed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
