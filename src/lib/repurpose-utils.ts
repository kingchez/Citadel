/**
 * Parses a person-typed timestamp into seconds.
 * Accepts "13", "0:13", "1:05", "1:02:03" and a decimal on the last part
 * ("0:13.5"). Minutes/seconds after the first part must be under 60.
 * Returns null for anything else, so callers never store a guess.
 */
export function parseTimeToSeconds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  const parts = s.split(":");
  if (parts.length > 3) return null;

  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i].trim();
    const isLast = i === parts.length - 1;
    const ok = isLast ? /^\d+(\.\d{1,3})?$/.test(p) : /^\d+$/.test(p);
    if (!ok) return null;
    const n = Number(p);
    if (i > 0 && n >= 60) return null;
    total = total * 60 + n;
  }
  return Math.round(total * 1000) / 1000;
}

export function formatSeconds(seconds: number): string {
  const whole = Math.floor(seconds);
  const frac = Math.round((seconds - whole) * 1000) / 1000;
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  // ".5" style suffix only when there is a fractional part
  const fracStr = frac > 0 ? frac.toFixed(3).slice(1).replace(/0+$/, "") : "";
  const secStr = String(s).padStart(2, "0") + fracStr;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${secStr}` : `${m}:${secStr}`;
}

/** Drive folder links look like file links to a naive parser but can never
 * be downloaded as a video - catch them explicitly. */
export function isDriveFolderUrl(url: string): boolean {
  return /\/drive\/(u\/\d+\/)?folders\//.test(url) || /\/folders\/[a-zA-Z0-9_-]+/.test(url);
}
