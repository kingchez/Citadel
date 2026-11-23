import type { VideoRow } from "./types";

/** Only the fields deriveNotifications actually reads - lets callers pass a
 * narrower Supabase `select()` result without a full VideoRow. */
export type NotificationSourceVideo = Pick<
  VideoRow,
  "id" | "title" | "status" | "error_details" | "script_segments" | "voice_timing" | "media_assets" | "updated_at"
>;

export interface NotificationSourceTrend {
  id: number;
  trending_keyword: string;
  status: string;
  usableVideos?: unknown;
  created_at: string;
}

export type NotificationType = "error" | "warning" | "info";

export interface CitadelNotification {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  detail?: string;
  video_id?: string;
  video_title?: string;
  source_label?: string;
  link_url?: string | null;
  workspace_alert_id?: string;
  occurrences?: number;
  created_at: string;
}

export interface WorkspaceNotificationRow {
  id: string;
  dedupe_key: string;
  source: string;
  source_ref: string | null;
  severity: "error" | "warning" | "action" | "info";
  title: string;
  details: string | null;
  link_url: string | null;
  status: "open" | "resolved";
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
}

const STUCK_STATUSES = new Set([
  "chatterbox_delivery_stuck",
  "whisperx_delivery_stuck",
  "render_delivery_stuck",
  "autobrowse_delivery_stuck",
]);

const EXPIRY_WARN_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Extracts a signed CDN URL expiration timestamp (ms since epoch) if present.
 * Supports Akamai (`akamai_token=exp=...`), generic `exp=` / `Expires=`,
 * AWS S3 (`X-Amz-Date` + `X-Amz-Expires`), and Azure SAS (`se=`).
 */
export function extractSignedUrlExpiry(rawUrl: string): number | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  // 1. Akamai / generic token `exp=1795347169` or `Expires=1795347169`
  const expMatch = rawUrl.match(/(?:^|[?&#~])(?:exp|expires)=(\d{10,13})(?:[&#~]|$)/i);
  if (expMatch?.[1]) {
    const num = Number(expMatch[1]);
    const ms = expMatch[1].length === 13 ? num : num * 1000;
    if (ms > 1_600_000_000_000 && ms < 4_000_000_000_000) return ms;
  }

  try {
    const u = new URL(rawUrl);
    // 2. AWS S3 presigned URL: X-Amz-Date=20261123T120000Z & X-Amz-Expires=3600
    const amzDate = u.searchParams.get("X-Amz-Date");
    const amzExp = u.searchParams.get("X-Amz-Expires");
    if (amzDate && amzExp && /^\d{8}T\d{6}Z$/.test(amzDate)) {
      const iso = `${amzDate.slice(0, 4)}-${amzDate.slice(4, 6)}-${amzDate.slice(6, 8)}T${amzDate.slice(9, 11)}:${amzDate.slice(11, 13)}:${amzDate.slice(13, 15)}Z`;
      const baseMs = Date.parse(iso);
      const ttlSec = Number(amzExp);
      if (Number.isFinite(baseMs) && Number.isFinite(ttlSec) && ttlSec > 0) {
        return baseMs + ttlSec * 1000;
      }
    }

    // 3. Azure Blob SAS: se=2026-11-23T18:00:00Z
    const se = u.searchParams.get("se");
    if (se) {
      const ms = Date.parse(se);
      if (Number.isFinite(ms)) return ms;
    }
  } catch {
    // Ignore malformed URLs
  }

  return null;
}

function extractVideoUrls(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? (raw as { items: unknown[] }).items
      : [];

  return list
    .map((item) => (item && typeof item === "object" ? (item as { url?: unknown }).url : null))
    .filter((u): u is string => typeof u === "string" && u.length > 0);
}

function formatDurationShort(ms: number): string {
  const absMins = Math.max(1, Math.round(Math.abs(ms) / 60_000));
  if (absMins < 60) return `${absMins}m`;
  const hrs = Math.round(absMins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export interface DerivedTrendExpiryNotification extends CitadelNotification {
  dedupe_key: string;
  trend_id: number;
}

/**
 * Checks pending `needs_review` trends for signed video URLs that have expired
 * or will expire within 24 hours.
 */
export function deriveTrendExpiryNotifications(
  trends: NotificationSourceTrend[],
  nowMs = Date.now()
): DerivedTrendExpiryNotification[] {
  const alerts: DerivedTrendExpiryNotification[] = [];

  for (const trend of trends) {
    if (trend.status !== "needs_review") continue;
    const urls = extractVideoUrls(trend.usableVideos);
    if (urls.length === 0) continue;

    let earliestExpMs: number | null = null;
    for (const url of urls) {
      const exp = extractSignedUrlExpiry(url);
      if (exp !== null && (earliestExpMs === null || exp < earliestExpMs)) {
        earliestExpMs = exp;
      }
    }

    if (earliestExpMs === null) continue;
    const diffMs = earliestExpMs - nowMs;
    if (diffMs > EXPIRY_WARN_WINDOW_MS) continue;

    const expired = diffMs <= 0;
    const dur = formatDurationShort(diffMs);
    const expIso = new Date(earliestExpMs).toISOString().replace("T", " ").slice(0, 16) + " UTC";

    alerts.push({
      id: `trend-expiry:${trend.id}`,
      dedupe_key: `trend-expiry:${trend.id}`,
      trend_id: trend.id,
      type: "warning",
      title: expired
        ? `Video URL expired — ${trend.trending_keyword}`
        : `Video URL expires in ${dur} — ${trend.trending_keyword}`,
      summary: expired
        ? `A signed clip URL on Trend #${trend.id} expired ${dur} ago (${expIso}) and will return 403 on playback/transcription.`
        : `Review and fetch transcript for Trend #${trend.id} before ${expIso} or the signed CDN URL will expire.`,
      source_label: "News Trend Review",
      link_url: "/news/review",
      created_at: trend.created_at,
    });
  }

  return alerts;
}

/**
 * Notifications combine live error fields sitting on `videos` (per-segment errors,
 * per-clip voice-timing errors, per-asset media errors, render errors, and stuck
 * delivery states) with open rows from the `workspace_notifications` table.
 */
export function deriveNotifications(videos: NotificationSourceVideo[]): CitadelNotification[] {
  const notifications: CitadelNotification[] = [];

  for (const video of videos) {
    for (const seg of video.script_segments || []) {
      if (seg.error) {
        notifications.push({
          id: `${video.id}:segment:${seg.index}`,
          type: "error",
          title: `Voiceover segment ${seg.index + 1} failed`,
          summary: seg.error,
          detail: seg.text,
          video_id: video.id,
          video_title: video.title,
          created_at: video.updated_at,
        });
      }
    }

    for (const clip of video.voice_timing || []) {
      if (clip.error) {
        notifications.push({
          id: `${video.id}:timing:${clip.index}`,
          type: "error",
          title: `Voice timing failed on clip ${clip.index + 1}`,
          summary: clip.error,
          video_id: video.id,
          video_title: video.title,
          created_at: video.updated_at,
        });
      }
    }

    if (video.media_assets) {
      for (const [key, asset] of Object.entries(video.media_assets)) {
        if (asset?.error) {
          notifications.push({
            id: `${video.id}:media:${key}`,
            type: "error",
            title: `Media asset failed (segment ${key})`,
            summary: asset.error,
            video_id: video.id,
            video_title: video.title,
            created_at: video.updated_at,
          });
        }
      }
    }

    if (video.status === "render_error") {
      notifications.push({
        id: `${video.id}:render`,
        type: "error",
        title: "Render failed",
        summary: video.error_details || "The render server rejected or failed this job.",
        video_id: video.id,
        video_title: video.title,
        created_at: video.updated_at,
      });
    }

    if (STUCK_STATUSES.has(video.status)) {
      notifications.push({
        id: `${video.id}:stuck`,
        type: "warning",
        title: `Delivery stuck (${video.status.replace("_delivery_stuck", "")})`,
        summary:
          video.error_details ||
          "The upstream service delivered a result but Citadel couldn't confirm it was saved. The 30-minute safety-net cron will retry automatically.",
        video_id: video.id,
        video_title: video.title,
        created_at: video.updated_at,
      });
    }
  }

  return notifications.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function normalizeText(text: string | null | undefined): string {
  return (text || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function extractVideoId(alert: WorkspaceNotificationRow, knownVideoIds: Set<string>): string | undefined {
  if (alert.link_url) {
    const match = alert.link_url.match(/\/pipeline\/videos\/([a-zA-Z0-9_-]+)/);
    if (match?.[1]) return match[1];
  }
  if (alert.source_ref && knownVideoIds.has(alert.source_ref)) {
    return alert.source_ref;
  }
  return undefined;
}

function isSameAlert(a: CitadelNotification, b: CitadelNotification): boolean {
  const titleA = normalizeText(a.title);
  const titleB = normalizeText(b.title);
  const sumA = normalizeText(a.summary);
  const sumB = normalizeText(b.summary);

  if (titleA === titleB && sumA === sumB) return true;

  if (a.video_id && b.video_id && a.video_id === b.video_id) {
    if (titleA === titleB || sumA === sumB) return true;
    if (sumA.length > 10 && sumB.length > 10 && (sumA.includes(sumB) || sumB.includes(sumA))) {
      return true;
    }
  }

  return false;
}

/**
 * Merges derived video error notifications with open rows from `workspace_notifications`,
 * deduplicating identical alerts so the same error only appears once.
 */
export function mergeAndDedupeNotifications(
  videoNotifications: CitadelNotification[],
  workspaceAlerts: WorkspaceNotificationRow[]
): CitadelNotification[] {
  const knownVideoIds = new Set(
    videoNotifications.map((n) => n.video_id).filter((id): id is string => Boolean(id))
  );

  const wsNotifications: CitadelNotification[] = workspaceAlerts.map((alert) => {
    const type: NotificationType =
      alert.severity === "error" ? "error" : alert.severity === "info" ? "info" : "warning";
    return {
      id: `ws:${alert.id}`,
      type,
      title: alert.title,
      summary: alert.details || alert.source,
      detail: alert.details || undefined,
      video_id: extractVideoId(alert, knownVideoIds),
      source_label: alert.source,
      link_url: alert.link_url,
      workspace_alert_id: alert.id,
      occurrences: alert.occurrences,
      created_at: alert.last_seen_at || alert.first_seen_at,
    };
  });

  const merged: CitadelNotification[] = [];

  for (const item of [...videoNotifications, ...wsNotifications]) {
    const existing = merged.find((m) => isSameAlert(m, item));
    if (existing) {
      if (new Date(item.created_at).getTime() > new Date(existing.created_at).getTime()) {
        existing.created_at = item.created_at;
      }
      if (!existing.video_id && item.video_id) existing.video_id = item.video_id;
      if (!existing.video_title && item.video_title) existing.video_title = item.video_title;
      if (!existing.link_url && item.link_url) existing.link_url = item.link_url;
      if (!existing.workspace_alert_id && item.workspace_alert_id) {
        existing.workspace_alert_id = item.workspace_alert_id;
      }
      if (item.occurrences && (!existing.occurrences || item.occurrences > existing.occurrences)) {
        existing.occurrences = item.occurrences;
      }
    } else {
      merged.push({ ...item });
    }
  }

  return merged.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
