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

/** One piece of a video post, in the order it will be used: a still image,
 * or a window (seconds) cut out of a source video. The same source video can
 * appear several times with different windows. `description` is what the reviewer
 * says the image shows or what happens in the clip; captions are written from it. */
export type MediaItem =
  | { type: "image"; url: string; description?: string }
  | { type: "clip"; url: string; start: number; end: number; description?: string };

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


// ---------------------------------------------------------------------------
// Canva news shorts (news_shorts table): one row per video made without voice-over
// ---------------------------------------------------------------------------

export type NewsShortStatus =
  | "queued"
  | "planning"
  | "plan_ready"
  | "approved"
  | "downloading"
  | "cutting"
  | "assembling"
  | "media_ready"
  | "designing"
  | "stitching"
  | "done"
  | "error";

export const NEWS_SHORT_STATUS_LABELS: Record<NewsShortStatus, string> = {
  queued: "Queued",
  planning: "Planning scenes",
  plan_ready: "Plan ready",
  approved: "Approved",
  downloading: "Downloading",
  cutting: "Cutting",
  assembling: "Merging",
  media_ready: "Ready for Canva",
  designing: "In Canva",
  stitching: "Joining scenes",
  done: "Done",
  error: "Failed",
};

export const NEWS_SHORT_STATUS_COLORS: Record<NewsShortStatus, "purple" | "cyan" | "green" | "amber" | "red"> = {
  queued: "purple",
  planning: "amber",
  plan_ready: "cyan",
  approved: "purple",
  downloading: "amber",
  cutting: "amber",
  assembling: "amber",
  media_ready: "cyan",
  designing: "amber",
  stitching: "amber",
  done: "green",
  error: "red",
};

export type SceneKind = "image" | "clip" | "intro" | "outro";

/** The source of one scene: an image, or a window cut from a video. */
export interface SceneAsset {
  type: "image" | "clip";
  url: string;
  start?: number;
  /** Where this scene's cut ends (start + the template's length). */
  end?: number;
  /** Where the reviewer's chosen window ends: how far this clip could be cut. */
  window_end?: number;
  /** What the reviewer said this shows. */
  description?: string;
}

/** One scene of a Canva short: a template, its on-screen text and its asset. */
export interface Scene {
  n: number;
  template: string;
  kind: SceneKind;
  duration: number;
  caption: string;
  assets: SceneAsset[];
  /** Filled after download and cutting: the file Canva will receive. */
  media_urls?: string[];
}

export interface CanvaTemplate {
  key: string;
  label: string;
  kind: SceneKind;
  duration_seconds: number;
  brand_template_id: string;
  caption_max: number;
  media_width: number;
  media_height: number;
  active: boolean;
  notes?: string | null;
}

export interface NewsShort {
  id: string;
  event_id: number;
  status: NewsShortStatus;
  headline?: string | null;
  summary?: string | null;
  media?: MediaItem[] | null;
  scenes?: Scene[] | null;
  media_url?: string | null;
  canva_design_id?: string | null;
  export_url?: string | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
  events?: { event_title?: string | null } | null;
}
