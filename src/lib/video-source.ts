import { extractDriveFileId } from "./utils";
import { isDriveFolderUrl } from "./repurpose-utils";

const DRIVE_HOSTS = ["drive.google.com", "docs.google.com", "drive.usercontent.google.com"];

export type VideoSource =
  | { ok: true; url: string; driveFileId: string | null }
  | { ok: false; error: string };

/**
 * Validates a video link typed into the form. Any direct http(s) link to a
 * video file is accepted (Google Drive, a storage bucket, a CDN...). Drive
 * links additionally get their file id extracted; everything else keeps a
 * null id and is fetched by URL later. Page links (YouTube, Vimeo...) can't
 * be told apart from file links here - the split endpoint rejects those with
 * a clear error at processing time.
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
    const id = extractDriveFileId(raw);
    if (!id) return { ok: false, error: `${label}: couldn't find a Drive file id in that link.` };
    return { ok: true, url: raw, driveFileId: id };
  }

  return { ok: true, url: raw, driveFileId: null };
}
