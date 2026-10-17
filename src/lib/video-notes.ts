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
}

const NOTE_KEY = /^note_(\d+)$/;

export function parseVideoNotes(notes: unknown): { notes: VideoNote[]; details: VideoDetailEntry[] } {
  // Older/odd rows may hold plain text instead of an object - show it, don't hide it.
  if (typeof notes === "string") return { notes: [], details: notes.trim() ? [{ key: "notes", value: notes }] : [] };
  if (!notes || typeof notes !== "object" || Array.isArray(notes)) return { notes: [], details: [] };

  const out: VideoNote[] = [];
  const details: VideoDetailEntry[] = [];
  for (const [key, value] of Object.entries(notes as Record<string, unknown>)) {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    const m = key.match(NOTE_KEY);
    if (m) out.push({ key, number: Number(m[1]), text });
    else details.push({ key, value: text });
  }
  out.sort((a, b) => a.number - b.number);
  return { notes: out, details };
}
