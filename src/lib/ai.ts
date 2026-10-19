/**
 * Minimal client for the OmniRoute gateway (OpenAI-compatible, the /v1 side).
 * Env:
 *   OMNIROUTE_BASE_URL  e.g. https://omniroute.viralnotely.com/v1
 *   OMNIROUTE_API_KEY   the gateway key
 *   PRODUCT_AI_MODEL    the model or combo name to use (whatever OmniRoute exposes)
 */
export function aiConfigured(): boolean {
  return !!(process.env.OMNIROUTE_BASE_URL && process.env.OMNIROUTE_API_KEY && process.env.PRODUCT_AI_MODEL);
}

/** Pulls the first JSON object out of a model reply (handles ```json fences and stray prose around it). */
function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```json|```/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("The AI reply wasn't valid JSON.");
  }
}

export async function chatJson(system: string, user: string, timeoutMs = 45000): Promise<unknown> {
  if (!aiConfigured()) throw new Error("AI isn't configured (set OMNIROUTE_BASE_URL, OMNIROUTE_API_KEY and PRODUCT_AI_MODEL).");
  const base = process.env.OMNIROUTE_BASE_URL!.replace(/\/+$/, "");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OMNIROUTE_API_KEY}` },
    body: JSON.stringify({
      model: process.env.PRODUCT_AI_MODEL,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`AI gateway answered ${res.status}.`);
  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("The AI gave an empty reply.");
  return parseJsonLoose(content);
}
