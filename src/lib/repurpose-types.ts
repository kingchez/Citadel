import type { ProductEntry, VideoType } from "./types";

export type RepurposeStatus =
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
  source_video_url: string;
  intro_mode: RepurposeIntroMode;
  new_intro_url: string | null;
  new_intro_start_seconds: number | null;
  notes: unknown;
  video_only_url: string | null;
  audio_url: string | null;
  voice_timing: unknown;
  error_details: string | null;
  video_id: string | null;
  created_at: string;
  updated_at: string;
  /** Linked videos row - products live there, not on the repurpose row. */
  video: { with_product: boolean | null; product_ids: ProductEntry[] | null } | null;
}

export const REPURPOSE_STATUS_LABELS: Record<RepurposeStatus, string> = {
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

export const REPURPOSE_ERROR_STATUSES: RepurposeStatus[] = ["split_error", "voice_timing_error"];
export const REPURPOSE_FINISHED_STATUSES: RepurposeStatus[] = ["handed_off", "cancelled"];
