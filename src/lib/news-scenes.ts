import type { CanvaTemplate, Scene, SceneAsset } from "@/lib/news-types";

/** A clip may be this many seconds shorter than its template before it is rejected. */
const CLIP_SLACK = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Checks a scene plan against the template registry. Returns a cleaned copy
 * (lengths taken from the templates, clips cut to the template length, numbering
 * fixed) or a message saying what is wrong.
 */
export function validateScenes(input: unknown, templates: CanvaTemplate[]): Scene[] | string {
  if (!Array.isArray(input) || input.length === 0) return "A plan needs at least one scene.";
  if (input.length > 20) return "A plan can have at most 20 scenes.";

  const byKey = new Map(templates.map((t) => [t.key, t]));
  const out: Scene[] = [];

  for (let i = 0; i < input.length; i++) {
    const label = `Scene ${i + 1}`;
    const s = input[i] as Partial<Scene> | null;
    if (!s || typeof s !== "object") return `${label} is not valid.`;

    const t = typeof s.template === "string" ? byKey.get(s.template) : undefined;
    if (!t) return `${label}: unknown template.`;
    if (!t.active || !t.brand_template_id) return `${label}: the "${t.label}" template is not set up in Canva yet.`;

    const caption = typeof s.caption === "string" ? s.caption.trim() : "";
    if (caption.length > t.caption_max) {
      return `${label}: the caption is ${caption.length} characters; "${t.label}" allows ${t.caption_max}.`;
    }

    const assets = Array.isArray(s.assets) ? (s.assets as SceneAsset[]) : [];
    const duration = Number(t.duration_seconds);
    let cleaned: SceneAsset[] = [];

    if (t.kind === "intro" || t.kind === "outro") {
      if (assets.length > 0) return `${label}: an ${t.kind} scene has no media.`;
    } else {
      if (assets.length !== 1) return `${label}: needs exactly one ${t.kind}.`;
      const a = assets[0];
      if (!a || typeof a.url !== "string" || !a.url) return `${label}: the ${t.kind} is missing its link.`;
      if (a.type !== t.kind) {
        return `${label}: "${t.label}" is for a ${t.kind}, but this scene has a ${a.type}.`;
      }
      if (a.type === "clip") {
        if (typeof a.start !== "number" || typeof a.end !== "number" || a.start < 0 || a.end <= a.start) {
          return `${label}: the clip needs a start time before its end time.`;
        }
        const windowEnd = typeof a.window_end === "number" && a.window_end > a.end ? a.window_end : a.end;
        if (windowEnd - a.start < duration - CLIP_SLACK) {
          return `${label}: the chosen part of the clip is ${(windowEnd - a.start).toFixed(1)}s, shorter than the ${duration}s "${t.label}" template.`;
        }
        cleaned = [{ ...a, end: round2(a.start + duration), window_end: round2(windowEnd) }];
      } else {
        cleaned = [{ type: "image", url: a.url, ...(a.description ? { description: a.description } : {}) }];
      }
    }

    out.push({ n: i + 1, template: t.key, kind: t.kind, duration, caption, assets: cleaned });
  }
  return out;
}
