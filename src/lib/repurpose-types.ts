import type { ProductEntry, VideoType } from "./types";
import type { RepurposeSource, RepurposeIntro } from "./repurpose-sources";

export type RepurposeStatus =
  | "pending_download"
  | "downloading"
  | "download_error"
  | "pending_split"
  | "splitting"
  | "split_error"
  | "split_done"
  | "waiting_voice_timing"
  | "voice_timing_error"
  | "voice_timing_done"
  | "handed_off"
  | "cancelled";

export type RepurposeIntroMode = "keep_original" | "replace";

/** Channels the Add Video page can insert for. Deliberately just Viral Shop
 * for now - enforced again server-side in /api/pipeline/insert. */
export const SUPPORTED_CHANNELS = ["Viral Shop"] as const;

/** Answer to the mandatory subtitles question (pipeline manual v15).
 * "later" writes nothing to notes, so the planning agent still asks. */
export type SubtitleChoice = "yes" | "no" | "later";

export interface RepurposeRow {
  id: string;
  title: string;
  channel: string;
  video_type: VideoType;
  status: RepurposeStatus;
  /** The videos being repurposed: one = single video, several = merge. */
  sources: RepurposeSource[];
  intro_mode: RepurposeIntroMode;
  new_intro_url: string | null;
  /** json: the replacement intro's link + download state (null when intro_mode is keep_original). */
  new_intro_original_url: RepurposeIntro | null;
  new_intro_start_seconds: number | null;
  notes: unknown;
  voice_timing: unknown;
  error_details: string | null;
  video_id: string | null;
  created_at: string;
  updated_at: string;
  /** Linked videos row - products live there, not on the repurpose row. */
  video: { with_product: boolean | null; product_ids: ProductEntry[] | null } | null;
}

export const REPURPOSE_STATUS_LABELS: Record<RepurposeStatus, string> = {
  pending_download: "Pending Download",
  downloading: "Downloading",
  download_error: "Download Failed",
  pending_split: "Pending Split",
  splitting: "Splitting",
  split_error: "Split Error",
  split_done: "Split Done",
  waiting_voice_timing: "Waiting Voice Timing",
  voice_timing_error: "Voice Timing Error",
  voice_timing_done: "Voice Timing Done",
  handed_off: "Handed Off",
  cancelled: "Cancelled",
};

export const REPURPOSE_STATUS_COLORS: Record<RepurposeStatus, "purple" | "cyan" | "green" | "amber" | "red"> = {
  pending_download: "purple",
  downloading: "cyan",
  download_error: "red",
  pending_split: "purple",
  splitting: "cyan",
  split_error: "red",
  split_done: "green",
  waiting_voice_timing: "cyan",
  voice_timing_error: "red",
  voice_timing_done: "green",
  handed_off: "green",
  cancelled: "amber",
};

export const REPURPOSE_ERROR_STATUSES: RepurposeStatus[] = ["download_error", "split_error", "voice_timing_error"];

/** Where a failed item goes when "Retry" is pressed. */
export const REPURPOSE_RETRY_TARGET: Partial<Record<RepurposeStatus, RepurposeStatus>> = {
  download_error: "pending_download",
  split_error: "pending_split",
  voice_timing_error: "split_done",
};
export const REPURPOSE_FINISHED_STATUSES: RepurposeStatus[] = ["handed_off", "cancelled"];
