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
  | "revision_requested"
  | "retrying"
  | "done"
  | "shipped"
  | "chatterbox_delivery_stuck"
  | "whisperx_delivery_stuck"
  | "render_delivery_stuck"
  | "autobrowse_delivery_stuck";

export type VideoType = "vertical-shorts" | "horizontal-long";

export interface ScriptSegment {
  index: number;
  text?: string;
  voiceover_drive_file_id?: string;
  error?: string;
  /** Set when the text was edited in Citadel after this segment already had
   * a voiceover, and the person declined the "retry now?" prompt. A
   * standing reminder until they click retry - cleared automatically the
   * moment a successful retry rebuilds this segment. */
  edited_pending_retry?: boolean;
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
  /** Freeform note Kingsley leaves for whichever agent handles this asset -
   * set directly from the Media tab in Citadel. */
  citadel_note?: string;
  /** Set when the asset was swapped by hand through Citadel rather than
   * fetched by the pipeline - the resulting shape is otherwise identical to
   * an automated fetch (driveFileId/status/source) so downstream nodes
   * don't need to care who provided it. */
  replaced_via_citadel_at?: string;
  [key: string]: unknown;
}

export type RevisionStatus = "pending" | "resolved";

export interface ProductEntry {
  index: number;
  asin: string;
  source_url?: string;
  added_at: string;
}
export interface RevisionEntry {
  id: string;
  note: string;
  status: RevisionStatus;
  created_at: string;
  resolved_at?: string | null;
}

export interface ActiveRetry {
  source?: string;
  segment_indices?: number[];
  requested_at?: string;
}

export interface VideoRow {
  id: string;
  title: string;
  channel: string;
  status: VideoStatus;
  video_type: VideoType;
  notes?: unknown;
  priority?: boolean;
  source_event_id?: number | null;
  with_product?: boolean;
  product_ids?: ProductEntry[];
  product_output_url?: string;
  script_segments?: ScriptSegment[];
  voice_timing?: VoiceTimingEntry[];
  scenes?: unknown;
  media_assets?: Record<string, MediaAssetEntry>;
  render_job_id?: string;
  output_drive_link?: string;
  error_details?: string;
  revision_history?: RevisionEntry[];
  active_retry?: ActiveRetry | null;
  vps_in_use?: boolean;
  vps_status?: string;
  vps_current_service?: string | null;
  vps_job_triggered_at?: string;
  retry_batch_id?: string;
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
export const REVIEW_STATUSES: VideoStatus[] = ["media_review", "production_review"];

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
  "chatterbox_delivery_stuck",
  "whisperx_delivery_stuck",
  "render_delivery_stuck",
  "autobrowse_delivery_stuck",
];

/** Statuses that mean "finished," for the Done tab and dashboard stat. */
export const DONE_STATUSES: VideoStatus[] = ["done", "shipped"];

export const STATUS_LABELS: Record<VideoStatus, string> = {
  planning: "Planning",
  script_written: "Script Written",
  waiting_voiceover: "Waiting Voiceover",
  partial_voiceover: "Partial Voiceover",
  voiceover_error: "Voiceover Error",
  voiceover_done: "Voiceover Done",
  waiting_voice_timing: "Waiting Voice Timing",
  partial_voice_timing: "Partial Voice Timing",
  voice_timing_error: "Voice Timing Error",
  voice_timing_done: "Voice Timing Done",
  scenes_planned: "Scenes Planned",
  awaiting_media: "Awaiting Media",
  media_review: "Media Review",
  media_ready: "Media Ready",
  final_scene_planned: "Scene Planned",
  rendering: "Rendering",
  render_error: "Render Error",
  production_review: "Production Review",
  revision_requested: "Revision Requested",
  retrying: "Retrying",
  done: "Done",
  shipped: "Shipped",
  chatterbox_delivery_stuck: "Chatterbox Delivery Stuck",
  whisperx_delivery_stuck: "WhisperX Delivery Stuck",
  render_delivery_stuck: "Render Delivery Stuck",
  autobrowse_delivery_stuck: "Media Delivery Stuck",
};

/** purple | cyan | green | amber | red - matches Citadel's five status colors. */
export type StatusColor = "purple" | "cyan" | "green" | "amber" | "red";

export const STATUS_COLORS: Record<VideoStatus, StatusColor> = {
  planning: "purple",
  script_written: "purple",
  waiting_voiceover: "cyan",
  partial_voiceover: "amber",
  voiceover_error: "red",
  voiceover_done: "green",
  waiting_voice_timing: "cyan",
  partial_voice_timing: "amber",
  voice_timing_error: "red",
  voice_timing_done: "cyan",
  scenes_planned: "purple",
  awaiting_media: "cyan",
  media_review: "amber",
  media_ready: "green",
  final_scene_planned: "purple",
  rendering: "amber",
  render_error: "red",
  production_review: "amber",
  revision_requested: "red",
  retrying: "amber",
  done: "green",
  shipped: "green",
  chatterbox_delivery_stuck: "red",
  whisperx_delivery_stuck: "red",
  render_delivery_stuck: "red",
  autobrowse_delivery_stuck: "red",
};
