export type VideoStatus =
  | "planning"
  | "script_written"
  | "waiting_voiceover"
  | "partial_voiceover"
  | "voiceover_error"
  | "voiceover_done"
  | "waiting_voice_timing"
  | "partial_voice_timing"
  | "voice_timing_error"
  | "voice_timing_done"
  | "scenes_planned"
  | "awaiting_media"
  | "media_review"
  | "media_ready"
  | "final_scene_planned"
  | "rendering"
  | "render_error"
  | "production_review"
  | "retrying"
  | "done"
  | "shipped";

export type VideoType = "vertical-shorts" | "horizontal-long";

export interface ScriptSegment {
  index: number;
  text?: string;
  voiceover_drive_file_id?: string;
  error?: string;
}

export interface VoiceTimingEntry {
  index: number;
  language?: string;
  words?: unknown;
  segments?: unknown;
  error?: string;
}

export interface MediaAssetEntry {
  provided: boolean;
  source?: "stock" | "screen_recording" | "ai_generated" | "manual";
  status?: "pending" | "provided" | "partial" | "error";
  driveFileId?: string;
  error?: string;
  failedAtIndex?: number;
  asset_query?: string;
  recording_instructions?: string;
  autobrowse_actions?: unknown[];
  video_generation_prompt?: string;
  image_prompt?: string;
  animation_prompt?: string;
  [key: string]: unknown;
}

export interface VideoRow {
  id: string;
  title: string;
  channel: string;
  status: VideoStatus;
  video_type: VideoType;
  notes?: unknown;
  with_product?: boolean;
  product_ids?: string[];
  script_segments?: ScriptSegment[];
  voice_timing?: VoiceTimingEntry[];
  scenes?: unknown;
  media_assets?: Record<string, MediaAssetEntry>;
  render_job_id?: string;
  output_drive_link?: string;
  error_details?: string;
  active_retry?: unknown;
  vps_in_use?: boolean;
  vps_job_triggered_at?: string;
  created_at: string;
  updated_at: string;
}

export type RetryService = "chatterbox" | "whisperx" | "render" | "autobrowse";
export type RetryStatus = "pending" | "dispatched" | "done" | "failed";

export interface RetryRow {
  id: string;
  video_id: string;
  service: RetryService;
  target: { segment_index?: number; clip_index?: number; code?: string } | null;
  status: RetryStatus;
  attempt_count: number;
  drive_file_id_to_delete?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

/** Review checkpoints where a one-click approve is meaningful. */
export const REVIEW_STATUSES: VideoStatus[] = [
  "media_review",
  "production_review",
];

/** Statuses that represent an item actively waiting on external work. */
export const IN_PROGRESS_STATUSES: VideoStatus[] = [
  "waiting_voiceover",
  "waiting_voice_timing",
  "rendering",
  "retrying",
];

/** Statuses that need the person's attention. */
export const ERROR_STATUSES: VideoStatus[] = [
  "voiceover_error",
  "voice_timing_error",
  "render_error",
  "partial_voiceover",
  "partial_voice_timing",
];
