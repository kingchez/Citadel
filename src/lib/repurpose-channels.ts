export type ChannelPlatform = "youtube" | "tiktok";
export type ChannelStatus = "pending" | "processing" | "active" | "paused" | "error";

/** A channel King added to scout repurpose videos from (table repurpose_source_channels). */
export interface SourceChannel {
  id: string;
  platform: ChannelPlatform;
  channel_username: string | null;
  channel_id: string | null;
  channel_name: string | null;
  avatar_url: string | null;
  status: ChannelStatus;
  error_details: string | null;
  last_checked_at: string | null;
  created_at: string;
  /** Videos from this channel currently waiting in the review pool. */
  video_count: number;
}

/** One scraped video waiting for review (table repurpose_scraped_videos). */
export interface ScrapedVideo {
  id: string;
  source_channel_id: string;
  platform: ChannelPlatform;
  video_id: string;
  video_url: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  is_shorts: boolean;
  published_at: string | null;
  channel_name: string | null;
}

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  pending: "Waiting to scrape",
  processing: "Scraping…",
  active: "Active",
  paused: "Paused",
  error: "Error",
};

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com"];
const HANDLE_RE = /^@?([A-Za-z0-9._-]{3,30})$/;
const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;

export type ParsedChannel =
  | { ok: true; channel_username: string | null; channel_id: string | null }
  | { ok: false; error: string };

/**
 * Reads whatever King pasted for a YouTube channel: "@handle", "handle", a youtube.com/@handle link,
 * a /channel/UC… link or a bare UC… channel id. Old-style /c/ and /user/ links can't be resolved without
 * an API call, so they are refused with a hint instead of being guessed.
 */
export function parseYoutubeChannelInput(input: unknown): ParsedChannel {
  if (typeof input !== "string" || !input.trim()) return { ok: false, error: "Paste a channel @handle or link." };
  const raw = input.trim();

  if (/^https?:\/\//i.test(raw)) {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return { ok: false, error: "That isn't a valid link." };
    }
    if (!YOUTUBE_HOSTS.includes(url.hostname.toLowerCase())) return { ok: false, error: "Only YouTube channel links are supported." };
    const first = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (first.startsWith("@")) {
      const m = first.match(HANDLE_RE);
      if (m) return { ok: true, channel_username: `@${decodeURIComponent(m[1])}`, channel_id: null };
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "channel" && CHANNEL_ID_RE.test(parts[1] ?? "")) return { ok: true, channel_username: null, channel_id: parts[1] };
    return { ok: false, error: "Use the channel's @handle link (youtube.com/@name) or its /channel/UC… link." };
  }

  if (CHANNEL_ID_RE.test(raw)) return { ok: true, channel_username: null, channel_id: raw };
  const m = raw.match(HANDLE_RE);
  if (m) return { ok: true, channel_username: `@${m[1]}`, channel_id: null };
  return { ok: false, error: "That doesn't look like a YouTube @handle or channel link." };
}
