/** Reads N8N_BASE_URL and strips any trailing slash, so it doesn't matter
 * whether the env var was set with or without one. */
export function getN8nBaseUrl(): string {
  const raw = process.env.N8N_BASE_URL;
  if (!raw) {
    throw new Error("N8N_BASE_URL is not configured.");
  }
  return raw.replace(/\/+$/, "");
}
