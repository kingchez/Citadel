import type { VideoRow } from "./types";

/** Only the fields deriveNotifications actually reads - lets callers pass a
 * narrower Supabase `select()` result without a full VideoRow. */
export type NotificationSourceVideo = Pick<
  VideoRow,
  "id" | "title" | "status" | "error_details" | "script_segments" | "voice_timing" | "media_assets" | "updated_at"
>;

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
