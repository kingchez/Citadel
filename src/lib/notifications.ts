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
  video_id: string;
  video_title: string;
  created_at: string;
}

const STUCK_STATUSES = new Set([
  "chatterbox_delivery_stuck",
  "whisperx_delivery_stuck",
  "render_delivery_stuck",
  "autobrowse_delivery_stuck",
]);

/**
 * Notifications aren't a stored table - they're derived live from the real
 * error fields already sitting on `videos` (per-segment errors, per-clip
 * voice-timing errors, per-asset media errors, render errors, and stuck
 * delivery states). Read/unread state is therefore ephemeral (tracked
 * client-side only) rather than persisted - acceptable for v1 since nothing
 * here is destructive, but worth a real `notification_reads` table later if
 * that ever matters.
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
