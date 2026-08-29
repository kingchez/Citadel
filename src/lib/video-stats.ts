import type { VideoRow } from "./types";
import { ERROR_STATUSES, IN_PROGRESS_STATUSES, REVIEW_STATUSES, DONE_STATUSES } from "./types";

export interface VpsServiceInfo {
  label: string;
  color: string;
}

const VPS_SERVICE_MAP: Record<string, VpsServiceInfo> = {
  chatterbox: { label: "Chatterbox (voiceover)", color: "var(--color-purple)" },
  whisperx: { label: "WhisperX (timing)", color: "var(--color-cyan)" },
  render: { label: "Render Server", color: "var(--color-amber)" },
  autobrowse: { label: "AutoBrowse (media)", color: "var(--color-green)" },
  citadel_redo: { label: "Chatterbox (Citadel redo)", color: "var(--color-purple)" },
};

/**
 * Which service currently holds the VPS lock, derived from `vps_status`
 * rather than a separate column. Every dispatch lane across both the main
 * pipeline and the Retries workflow already sets `vps_status` to
 * `dispatching_<service>` (optionally `_retry`) the moment it locks the
 * VPS, and clears it back to null the moment it releases - verified
 * consistent across every lock/release node in both workflows. A second
 * column mirroring the same information would only be another thing that
 * can drift out of sync with the ~30 write sites that would need to keep
 * it updated; this reads the value that's already there.
 */
export function parseVpsService(vpsStatus: string | null | undefined): VpsServiceInfo | null {
  if (!vpsStatus || !vpsStatus.startsWith("dispatching_")) return null;
  const raw = vpsStatus.replace(/^dispatching_/, "").replace(/_retry$/, "");
  return VPS_SERVICE_MAP[raw] || { label: raw, color: "var(--text-muted)" };
}
export interface VideoCounts {
  total: number;
  errors: number;
  progress: number;
  review: number;
  done: number;
}

type CountableVideo = Pick<VideoRow, "status" | "script_segments" | "voice_timing" | "media_assets">;

/**
 * Single source of truth for "is this video in an error state," used
 * identically by the sidebar badge, the dashboard stat card, and the videos
 * list tab counts - previously each computed this slightly differently,
 * which is exactly how they drift out of sync with each other.
 *
 * A video counts as errored if its overall status is one of the error
 * statuses, OR any individual script segment, voice-timing clip, or media
 * asset is carrying its own error - even if the aggregate status hasn't
 * rolled up to an error state yet (e.g. still sitting in `media_review`
 * while one media asset quietly failed in the background).
 */
export function hasAnyError(video: CountableVideo): boolean {
  if (ERROR_STATUSES.includes(video.status)) return true;
  if ((video.script_segments || []).some((s) => !!s.error)) return true;
  if ((video.voice_timing || []).some((c) => !!c.error)) return true;
  if (video.media_assets && Object.values(video.media_assets).some((a) => !!a?.error)) return true;
  return false;
}

export function isInProgress(video: Pick<VideoRow, "status">): boolean {
  return IN_PROGRESS_STATUSES.includes(video.status);
}

/** Needs a person's attention: sitting at a review checkpoint, or has an
 * open (pending) revision request. */
export function needsReview(video: Pick<VideoRow, "status" | "revision_history">): boolean {
  if (REVIEW_STATUSES.includes(video.status) || video.status === "revision_requested") return true;
  return (video.revision_history || []).some((r) => r.status === "pending");
}

export function isDone(video: Pick<VideoRow, "status">): boolean {
  return DONE_STATUSES.includes(video.status);
}

/** Total is simply every video row that exists, with no filtering - the
 * plainest possible answer, and deliberately so: it's the one number that
 * should never need explaining. */
export function computeVideoCounts(
  videos: (CountableVideo & Pick<VideoRow, "revision_history">)[]
): VideoCounts {
  return {
    total: videos.length,
    errors: videos.filter(hasAnyError).length,
    progress: videos.filter(isInProgress).length,
    review: videos.filter(needsReview).length,
    done: videos.filter(isDone).length,
  };
}
