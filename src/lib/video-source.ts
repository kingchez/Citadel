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
