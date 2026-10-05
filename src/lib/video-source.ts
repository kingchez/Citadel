import { extractDriveFileId } from "./utils";
import { isDriveFolderUrl } from "./repurpose-utils";

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];

export type VideoSource =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Validates a video link typed into the form. Any direct http(s) link to a
 * video file is accepted (Google Drive, a storage bucket, a CDN...). Only the
 * URL is stored - anything that needs a Drive file id extracts it from the
 * URL at the time. Drive links are still sanity-checked (no folders, must
 * contain a file id) so an unusable one is refused up front. Page links
 * (YouTube, Vimeo...) can't be told apart from file links here - the split
 * endpoint rejects those with a clear error at processing time.
 */
export function resolveVideoSource(input: unknown, label: string): VideoSource {
  if (typeof input !== "string" || !input.trim()) return { ok: false, error: `${label}: paste a video link.` };
  const raw = input.trim();

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: `${label}: that isn't a valid link.` };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, error: `${label}: only http(s) links are supported.` };
  }

  const host = parsed.hostname.toLowerCase();
  // YouTube / TikTok page links are stored in their simple canonical form (no tracking parameters).
  const canonical = canonicalVideoUrl(raw);
  if (canonical) return { ok: true, url: canonical };
  if (DRIVE_HOSTS.includes(host)) {
    if (isDriveFolderUrl(raw)) {
      return { ok: false, error: `${label}: that is a Drive folder link - use the link to the video file itself.` };
    }
    if (!extractDriveFileId(raw)) return { ok: false, error: `${label}: couldn't find a Drive file id in that link.` };
    return { ok: true, url: raw };
  }

  return { ok: true, url: raw };
}

export type VideoLinkKind = "youtube" | "tiktok" | "direct";

const YOUTUBE_HOSTS = ["youtube.com", "m.youtube.com", "www.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"];
const TIKTOK_HOSTS = ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];

/**
 * Tells whether a link is a YouTube or TikTok PAGE link (which has to be
 * downloaded first) or anything else (treated as a direct video file link).
 * Drive links count as direct. The n8n download workflow does its own,
 * stricter check of the same thing before it downloads.
 */
export function classifyVideoUrl(input: string): VideoLinkKind {
  try {
    const host = new URL(input.trim()).hostname.toLowerCase();
    if (YOUTUBE_HOSTS.includes(host)) return "youtube";
    if (TIKTOK_HOSTS.includes(host)) return "tiktok";
  } catch {
    /* not a URL - callers validate separately */
  }
  return "direct";
}

/**
 * Returns the simple canonical link for a YouTube or TikTok page link, or null
 * if the link is neither (or can't be read - the caller then keeps it as typed).
 *  - YouTube (watch?v=, youtu.be/, shorts/, embed/, live/, v/) -> https://www.youtube.com/watch?v=ID
 *  - TikTok full link (/@user/video/ID)                          -> https://www.tiktok.com/@user/video/ID
 *  - TikTok short link (vm./vt. or /t/CODE)                      -> same link with the query string removed
 *    (short links can't be expanded without a network redirect, so only parameters are stripped).
 */
export function canonicalVideoUrl(input: string): string | null {
  const raw = input.trim();
  const yt = raw.match(
    /^https?:\/\/(?:www\.|m\.|music\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/i
  );
  if (yt) return `https://www.youtube.com/watch?v=${yt[1]}`;

  const tt = raw.match(/^https?:\/\/(?:www\.|m\.)?tiktok\.com\/(@[^/\s?#]+)\/video\/(\d+)/i);
  if (tt) return `https://www.tiktok.com/${tt[1]}/video/${tt[2]}`;
  const short = raw.match(/^https?:\/\/(vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i);
  if (short) return `https://${short[1].toLowerCase()}.tiktok.com/${short[2]}/`;
  const t = raw.match(/^https?:\/\/(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)/i);
  if (t) return `https://www.tiktok.com/t/${t[1]}/`;
  return null;
}
