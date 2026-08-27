import { NextRequest, NextResponse } from "next/server";

/**
 * Streams a Google Drive file (audio segment or rendered video output) through
 * this server so it can be played directly inside Citadel instead of opening
 * a new tab. Works for any file shared "anyone with the link, viewer" (which
 * is how the pipeline already shares everything it uploads).
 *
 * Drive's plain `uc?export=download` link shows an HTML "can't scan this
 * file for viruses" interstitial for anything past a few MB - which is every
 * rendered video and some longer voiceover segments. Appending `confirm=t`
 * bypasses that interstitial for anyone-with-link files, so we always send
 * it rather than trying to detect the interstitial after the fact.
 *
 * Range requests are forwarded so the video/audio elements can seek without
 * downloading the whole file first.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;

  if (!fileId) {
    return NextResponse.json({ error: "Missing file id." }, { status: 400 });
  }

  const upstreamUrl = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`;

  const range = request.headers.get("range");
  const upstreamHeaders: Record<string, string> = {};
  if (range) upstreamHeaders["range"] = range;

  const upstream = await fetch(upstreamUrl, { headers: upstreamHeaders, redirect: "follow" });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Drive returned ${upstream.status} for file ${fileId}. It may not be shared "anyone with the link."` },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  const headers = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
  ];
  for (const h of passthroughHeaders) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  if (!headers.has("cache-control")) headers.set("cache-control", "private, max-age=3600");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
