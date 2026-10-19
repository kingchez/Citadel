/**
 * Name matching for the product finder. Pure functions, no I/O.
 *
 * Script names ("Portable changing room") and site titles
 * ("Portable Changing Room Tent - Privacy Shelter [2-Pack], Camping") differ in
 * punctuation, casing, length and sometimes spelling. Everything is compared
 * after normalising, token by token, with a little spelling tolerance.
 */

const STOPWORDS = new Set(["the", "a", "an", "and", "of", "for", "with", "to", "in", "on", "by", "or"]);

/** Lowercase, strip accents, turn every - _ , ( ) [ ] / & etc. into a space, collapse spaces. */
export function normalizeName(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Normalised words, minus filler words and a trailing plural "s" (so "organizers" ~ "organizer"). */
export function tokenize(input: string): string[] {
  const words = normalizeName(input).split(" ").filter(Boolean);
  const meaningful = words.filter((w) => !STOPWORDS.has(w));
  return (meaningful.length > 0 ? meaningful : words).map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

function editDistanceAtMost1(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1); // one substitution
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  return shorter.slice(i) === longer.slice(i + 1); // one insertion/deletion
}

/** Same word, allowing one typo / spelling variant (organiser vs organizer) on words of 5+ letters, or a shared 4+ letter stem. */
function tokensMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (/^\d+$/.test(a) || /^\d+$/.test(b)) return false; // numbers (sizes, pack counts) must match exactly
  if (a.length >= 5 && b.length >= 5 && editDistanceAtMost1(a, b)) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

function matchedCount(query: string[], title: string[]): number {
  const used = new Set<number>();
  let n = 0;
  for (const q of query) {
    const idx = title.findIndex((t, i) => !used.has(i) && tokensMatch(q, t));
    if (idx >= 0) {
      used.add(idx);
      n++;
    }
  }
  return n;
}

export interface ScoreResult {
  score: number; // 0..1
  exact: boolean;
}

/**
 * How well a site title matches a script product name.
 * - containment (how much of the NAME shows up in the TITLE) dominates, because site titles are
 *   usually longer than what is said in the video.
 * - a light dice term keeps "Portable Changing Room" above "Portable Changing Room ... 10 other words".
 * - starting with the name gets a small bonus.
 * - the first 3 words alone can still surface the "family" of products (cap 0.6), so "portable ..."
 *   products show up as picks when nothing better exists.
 */
export function scoreName(name: string, title: string): ScoreResult {
  const normName = normalizeName(name);
  const normTitle = normalizeName(title);
  if (!normName || !normTitle) return { score: 0, exact: false };
  if (normName === normTitle) return { score: 1, exact: true };

  const q = tokenize(name);
  const t = tokenize(title);
  if (q.length === 0 || t.length === 0) return { score: 0, exact: false };

  const hit = matchedCount(q, t);
  const containment = hit / q.length;
  const dice = (2 * hit) / (q.length + t.length);
  let full = 0.85 * containment + 0.15 * dice;
  if (normTitle.startsWith(normName)) full = Math.min(1, full + 0.05);

  const headTokens = q.slice(0, Math.min(3, q.length));
  const headHit = matchedCount(headTokens, t) / headTokens.length;
  const head = 0.6 * headHit;

  return { score: Math.max(full, head), exact: false };
}

export type MatchStatus = "exact" | "likely" | "ambiguous" | "none";

export interface Ranked<T> {
  item: T;
  score: number;
  exact: boolean;
}

/** Scores every catalog row, drops duplicates (same normalised title), sorts best first. */
export function rankTitles<T extends { title: string }>(name: string, rows: T[], limit = 8, minScore = 0.5): Ranked<T>[] {
  const seen = new Set<string>();
  const ranked: Ranked<T>[] = [];
  for (const row of rows) {
    const { score, exact } = scoreName(name, row.title);
    if (score < minScore) continue;
    const key = normalizeName(row.title);
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({ item: row, score, exact });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

/**
 * exact     - the normalised names are identical, or the best match is ~perfect and nothing else is close.
 * likely    - clearly best: high score and a real gap to the runner-up.
 * ambiguous - several plausible matches (or one mediocre one): needs the AI cleanup and/or a human pick.
 * none      - nothing reached the minimum score.
 */
export function classify(ranked: Ranked<unknown>[]): MatchStatus {
  if (ranked.length === 0) return "none";
  const [top, second] = ranked;
  const gap = second ? top.score - second.score : 1;
  if (top.exact && gap >= 0.05) return "exact";
  if (top.score >= 0.97 && gap >= 0.1) return "exact";
  if (top.score >= 0.85 && gap >= 0.1) return "likely";
  return "ambiguous";
}
