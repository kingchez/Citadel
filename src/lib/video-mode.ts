import type { VideoRow } from "./types";

/** How a video is produced: the Remotion render server (voiced pipeline) or a Canva scene-based short. */
export type RenderMode = "render" | "canva";

/** Columns added to `videos` for the voiceless lane. Optional so older rows/selects still type-check. */
export interface VideoMode {
  voiceover?: boolean;
  render_mode?: RenderMode;
  selected_media?: unknown;
}

export type VideoWithMode = VideoRow & VideoMode;

export function isCanvaVideo(v: VideoMode): boolean {
  return v.render_mode === "canva";
}

/** Short badge text for list/detail pages. Null = a normal voiced video (no badge needed). */
export function modeLabel(v: VideoMode): string | null {
  if (v.voiceover === false) return v.render_mode === "canva" ? "No voice-over · Canva" : "No voice-over · Render";
  return null;
}
