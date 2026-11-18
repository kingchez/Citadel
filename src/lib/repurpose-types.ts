import type { ProductEntry, VideoType } from "./types";
import type { RepurposeSource, RepurposeIntro } from "./repurpose-sources";

export type RepurposeStatus =
  | "waiting_merge"
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
  /** Product step (Citadel Products page): null = not started, extracting = agent reading the transcript,
   * review = waiting for King to confirm, confirmed = products + footage windows locked in. */
  products_step?: "extracting" | "review" | "confirmed" | null;
  voice_timing: unknown;
  error_details: string | null;
  video_id: string | null;
  created_at: string;
  updated_at: string;
  /** Linked videos row - products live there, not on the repurpose row. */
  video: { with_product: boolean | null; product_ids: ProductEntry[] | null; notes?: unknown } | null;
}

export const REPURPOSE_STATUS_LABELS: Record<RepurposeStatus, string> = {\n  waiting_merge: "Waiting Merge",\n  pending_download: "Pending Download",\n  downloading: "Downloading",\n  download_error: "Download Failed",\n  pending_split: "Pending Split",\n  splitting: "Splitting",\n  split_error: "Split Error",\n  split_done: "Split Done",\n  waiting_voice_timing: "Waiting Voice Timing",\n  voice_timing_error: "Voice Timing Error",\n  voice_timing_done: "Voice Timing Done",\n  handed_off: "Handed Off",\n  cancelled: "Cancelled",\n};\n\nexport const REPURPOSE_STATUS_COLORS: Record<RepurposeStatus, "purple" | "cyan" | "green" | "amber" | "red"> = {\n  waiting_merge: "amber",\n  pending_download: "purple",\n  downloading: "cyan",\n  download_error: "red",\n  pending_split: "purple",\n  splitting: "cyan",\n  split_error: "red",\n  split_done: "green",\n  waiting_voice_timing: "cyan",\n  voice_timing_error: "red",\n  voice_timing_done: "green",\n  handed_off: "green",\n  cancelled: "amber",\n};\n\nexport const REPURPOSE_ERROR_STATUSES: RepurposeStatus[] = ["download_error", "split_error", "voice_timing_error"];\n\n/** Where a failed item goes when "Retry" is pressed. */\nexport const REPURPOSE_RETRY_TARGET: Partial<Record<RepurposeStatus, RepurposeStatus>> = {\n  download_error: "pending_download",\n  split_error: "pending_split",\n  voice_timing_error: "split_done",\n};\nexport const REPURPOSE_FINISHED_STATUSES: RepurposeStatus[] = ["handed_off", "cancelled"];
