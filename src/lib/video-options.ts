/**
 * Per-video options kept in videos.notes next to note_N (the planning agent reads them there).
 * "Decide later" = the key is absent, so the agent asks - same as the subtitles answer has always worked.
 */
export type YesNoLater = "yes" | "no" | "later";
export type SubtitleOption = YesNoLater;
export type ScriptChoice = YesNoLater;

export const DIRECTION_VALUES = ["FRONT - BACK", "BACK - FRONT", "RANDOM"] as const;
export type DirectionValue = (typeof DIRECTION_VALUES)[number];
export type DirectionChoice = DirectionValue | "later";

export const INTRO_STYLE_VALUES = ["four_clips", "single"] as const;
export type IntroStyleChoice = (typeof INTRO_STYLE_VALUES)[number];

export const INTRO_CLIP_SOURCE_VALUES = ["random_from_video", "keep_original", "clip_from_video", "replace"] as const;
export type IntroClipSourceChoice = (typeof INTRO_CLIP_SOURCE_VALUES)[number];

export const OPTION_KEYS = [
  "subtitles",
  "change_product_video_script",
  "product_listing_direction",
  "intro_style",
  "intro_clip_source",
] as const;
export type OptionKey = (typeof OPTION_KEYS)[number];

export interface OptionDef {
  key: OptionKey;
  label: string;
  hint: string;
  values: readonly string[];
}

export const OPTION_DEFS: OptionDef[] = [
  { key: "subtitles", label: "Subtitles", hint: "“Decide later” leaves it for the planning agent to ask.", values: ["yes", "no"] },
  { key: "change_product_video_script", label: "Change original product video script", hint: "Whether the script of the original product video gets rewritten.", values: ["yes", "no"] },
  { key: "product_listing_direction", label: "Product listing direction", hint: "The order the products are listed in the video.", values: DIRECTION_VALUES },
  { key: "intro_style", label: "Intro style", hint: "4-clip 2×2 grid intro or a single full-screen intro clip.", values: INTRO_STYLE_VALUES },
  { key: "intro_clip_source", label: "Intro clip source", hint: "Where the intro footage comes from (random 4 clips, original intro, clip from video, or external link).", values: INTRO_CLIP_SOURCE_VALUES },
];

export function isOptionKey(key: string): key is OptionKey {
  return (OPTION_KEYS as readonly string[]).includes(key);
}
