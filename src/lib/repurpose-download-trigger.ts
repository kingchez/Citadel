import { getN8nBaseUrl } from "./n8n";

/**
 * Pings the n8n download workflow so a new YouTube/TikTok item starts
 * downloading immediately. Fire-and-forget by design: the item is already
 * saved as `pending_download`, and the workflow also sweeps for pending items
 * every 10 minutes, so a failed ping only delays the download - it never loses it.
 */
export async function notifyRepurposeDownload(repurposeId: string): Promise<boolean> {
  try {
    const res = await fetch(`${getN8nBaseUrl()}/webhook/repurpose-download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repurpose_id: repurposeId }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
