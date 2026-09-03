export type EventStatus = "unprocessed" | "processing" | "reviewed" | "paused";

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
  unprocessed: "Unprocessed",
  processing: "Processing",
  reviewed: "Reviewed",
  paused: "Paused",
};

export const EVENT_STATUS_COLORS: Record<EventStatus, "purple" | "cyan" | "green" | "amber" | "red"> = {
  unprocessed: "cyan",
  processing: "amber",
  reviewed: "green",
  paused: "red",
};
