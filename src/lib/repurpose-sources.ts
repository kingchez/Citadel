import { classifyVideoUrl } from "./video-source";

export type SourceState = "pending" | "done" | "error";

/** One video being repurposed. A repurpose item holds an array of these (1 = single video, 2+ = merge). */
export interface RepurposeSource {
  index: number;
  original_url: string;
  /** Working link: the original for direct files, or the bucket copy once a YouTube/TikTok link was downloaded. */
  url: string;
  kind: "youtube" | "tiktok" | "direct";
  download: SourceState;
  download_error: string | null;
  split: SourceState;
  split_error: string | null;
  video_only_url: string | null;
  audio_url: string | null;
  timing: SourceState;
  timing_error: string | null;
}

export const MAX_SOURCES = 20;

/** Builds the json item for a newly typed link. Direct links need no download, so they start as downloaded. */
export function newSourceItem(url: string, index = 0): RepurposeSource {
  const kind = classifyVideoUrl(url);
  return {
    index,
    original_url: url,
    url,
    kind,
    download: kind === "direct" ? "done" : "pending",
    download_error: null,
    split: "pending",
    split_error: null,
    video_only_url: null,
    audio_url: null,
    timing: "pending",
    timing_error: null,
  };
}

/** Short plain-language stage of one video, for the queue. */
export function sourceStage(s: RepurposeSource): { label: string; tone: "ok" | "wait" | "error"; detail: string | null } {
  if (s.download === "error") return { label: "Download failed", tone: "error", detail: s.download_error };
  if (s.download !== "done") return { label: "Waiting to download", tone: "wait", detail: null };
  if (s.split === "error") return { label: "Split failed", tone: "error", detail: s.split_error };
  if (s.split !== "done") return { label: "Waiting to split", tone: "wait", detail: null };
  if (s.timing === "error") return { label: "Timing failed", tone: "error", detail: s.timing_error };
  if (s.timing !== "done") return { label: "Waiting for voice timing", tone: "wait", detail: null };
  return { label: "Ready", tone: "ok", detail: null };
}
