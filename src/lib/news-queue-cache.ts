/**
 * Caches the ordered queue of event IDs (as last fetched by the events list
 * page) in sessionStorage, so the detail page's prev/next navigation
 * doesn't need to re-fetch and re-sort the entire events list - including
 * every article body and thumbnail candidate array - on every single click.
 * Only a fetch of the one event actually being viewed is needed per
 * navigation.
 */
const KEY = "citadel_news_queue";

export interface QueueEntry {
  id: number;
  social_headline?: string;
  event_title?: string;
}

export function saveQueue(entries: QueueEntry[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage unavailable (e.g. private browsing) - prev/next just
    // falls back to a full re-fetch, no functional loss.
  }
}

export function loadQueue(): QueueEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
