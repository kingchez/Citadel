/**
 * videos.notes is a json object. Notes King (or the Add Video form) writes are `note_1`, `note_2`, ... - the
 * planning agent reads those as instructions. Other keys (subtitles, article content from "convert to video", ...)
 * are pipeline details and are shown read-only.
 */
export interface VideoNote {
  key: string;
  number: number;
  text: string;
}
export interface VideoDetailEntry {
  key: string;
  value: string;
  /** Only plain text values can be edited as text; anything else can still be deleted. */
  editable: boolean;
}

import { OPTION_KEYS } from "./video-options";

const NOTE_KEY = /^note_(\d+)$/;

/** Current value of a video option, or "" when it is "decide later" (key absent). */
export function readOption(notes: unknown, key: string): string {
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return "";
  const v = (notes as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

export function parseVideoNotes(notes: unknown): { notes: VideoNote[]; details: VideoDetailEntry[] } {
  // Older/odd rows may hold plain text instead of an object - show it, don't hide it.
  if (typeof notes === "string") return { notes: [], details: notes.trim() ? [{ key: "notes", value: notes, editable: false }] : [] };
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return { notes: [], details: [] };

  const out: VideoNote[] = [];
  const details: VideoDetailEntry[] = [];
  for (const [key, value] of Object.entries(notes as Record<string, unknown>)) {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const m = key.match(NOTE_KEY);
    if (m) out.push({ key, number: Number(m[1]), text });
    else if (!(OPTION_KEYS as readonly string[]).includes(key)) details.push({ key, value: text, editable: typeof value === "string" });
  }
  out.sort((a, b) => a.number - b.number);
  return { notes: out, details };
}
