export type EventStatus =
  | "pending"
  | "unprocessed"
  | "processing"
  | "reviewed"
  | "paused"
  | "ready"
  | "scheduled";

export type PostFormat = "video" | "static";

export interface ArticleContent {
  title?: string;
  dek?: string;
  body?: string;
}

export interface NewsEvent {
  id: number;
  event_title?: string;
  fingerprint?: string;
  snapshot_summary?: string;
  global_relevance_score?: number;
  confidence?: number;
  created_at: string;
  article?: ArticleContent;
  seo?: Record<string, unknown>;
  editorial_metadata?: Record<string, unknown>;
  usablethumbnails?: unknown;
  usablevideos?: unknown;
  social_headline?: string;
  alt_thumbnail?: string;
  thumbnail?: string;
  status: EventStatus;
  category_reference?: string;
  wordpress_posted?: boolean;
  is_reviewed?: boolean;
  golden_window_hours?: number;
  video_id?: string | null;
  post_format?: PostFormat | null;
  selected_media?: MediaItem[] | null;
  selected_thumbnails?: string[] | null;
  voiceover?: boolean;
}

/** Pulls a flat array of candidate thumbnail URLs out of usablethumbnails,
 * which arrives in a few different shapes depending on what the news
 * pipeline wrote (raw array, {items: [...]}, or a plain object of URLs). */
export function extractThumbnailCandidates(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.filter((v): v is string => typeof v === "string");
    return Object.values(obj).filter((v): v is string => typeof v === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return extractThumbnailCandidates(parsed);
    } catch {
      return [];
    }
  }
  return [];
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  pending: "Pending",
  unprocessed: "Unprocessed",
  processing: "Processing",
  reviewed: "Reviewed",
  paused: "Paused",
  ready: "Ready",
  scheduled: "Scheduled",
};

export const EVENT_STATUS_COLORS: Record<EventStatus, "purple" | "cyan" | "green" | "amber" | "red"> = {
  pending: "purple",
  unprocessed: "cyan",
  processing: "amber",
  reviewed: "green",
  paused: "red",
  ready: "cyan",
  scheduled: "purple",
};

// ---------------------------------------------------------------------------
// Trend review (first human review, before a trend becomes an event)
// ---------------------------------------------------------------------------

/** One piece of a video post, in the order it will be merged: a still image,
 * or a window (seconds) cut out of a source video. The same source video can
 * appear several times with different windows. */
export type MediaItem =
  | { type: "image"; url: string }
  | { type: "clip"; url: string; start: number; end: number; note?: string };

/** How long a still image stays on screen when merged into a video. */
export const IMAGE_SECONDS = 3;

export function mediaDuration(items: MediaItem[]): number {
  return items.reduce((sum, m) => sum + (m.type === "image" ? IMAGE_SECONDS : m.end - m.start), 0);
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|avif)(\?|#|$)/i;
export function isImageUrl(url: string): boolean {
  return IMAGE_EXT.test(url);
}

/** A video Diffbot found inside one of the trend's articles. */
export interface TrendVideo {
  url: string;
  primary?: boolean;
  article_title?: string;
  article_link?: string;
  source?: string;
}

export interface TrendNewsItem {
  title?: string;
  url?: string;
  source?: string;
  picture?: string;
}

export interface TrendReview {
  id: number;
  trending_keyword: string;
  traffic?: string | null;
  pubdate?: string | null;
  picture?: string | null;
  news_items?: unknown;
  usableThumbnails?: unknown;
  usableVideos?: unknown;
  status: string;
  created_at: string;
  post_format?: PostFormat | null;
  /** Main thumbnail (the first of selected_thumbnails). */
  selected_thumbnail?: string | null;
  selected_thumbnails?: string[] | null;
  selected_media?: MediaItem[] | null;
  voiceover?: boolean;
  reviewed_at?: string | null;
}

/** n8n writes lists as either a raw array or {items: [...]}. */
function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)) {
    return (raw as { items: unknown[] }).items;
  }
  return [];
}

export function extractTrendNewsItems(raw: unknown): TrendNewsItem[] {
  return extractItems(raw).filter((v): v is TrendNewsItem => !!v && typeof v === "object");
}

export function extractTrendVideos(raw: unknown): TrendVideo[] {
  return extractItems(raw).filter(
    (v): v is TrendVideo => !!v && typeof v === "object" && typeof (v as TrendVideo).url === "string" && !!(v as TrendVideo).url
  );
}

/** "12", "12.5", "1:05" or "1:02:03" -> seconds, or null when it isn't a time. */
export function parseTimecode(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":");
  if (parts.length > 3 || parts.some((p) => p.trim() === "" || isNaN(Number(p)))) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => n < 0)) return null;
  return nums.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 10) / 10);
  const m = Math.floor(total / 60);
  const sec = total - m * 60;
  const secText = Number.isInteger(sec) ? String(sec).padStart(2, "0") : sec.toFixed(1).padStart(4, "0");
  return `${m}:${secText}`;
}
