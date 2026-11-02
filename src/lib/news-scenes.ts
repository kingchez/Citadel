import type { CanvaTemplate, Scene, SceneAsset } from "@/lib/news-types";

/** A clip may be this many seconds shorter than its slot before it is rejected. */
const CLIP_SLACK = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whether a template's slots take this kind of asset. */
export function templateAccepts(t: CanvaTemplate, assetType: "image" | "clip"): boolean {
  return t.kind === "mixed" || t.kind === assetType;
}

/** The longest a clip can be cut for its scene, i.e. the reviewer's chosen window. */
export function clipWindow(a: SceneAsset): number {
  return (a.window_end ?? a.end ?? 0) - (a.start ?? 0);
}

/**
 * Checks a scene plan against the template registry. Returns a cleaned copy
 * (lengths taken from the template slots, clips cut to their slot length,
 * numbering fixed) or a message saying what is wrong.
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
    const cleaned: SceneAsset[] = [];

    if (t.kind === "intro" || t.kind === "outro") {
      if (assets.length > 0) return `${label}: an ${t.kind} scene has no media.`;
    } else {
      const slots = Array.isArray(t.slots) ? t.slots : [];
      if (slots.length === 0) return `${label}: the "${t.label}" template has no media slots.`;
      if (assets.length !== slots.length) {
        return `${label}: "${t.label}" holds ${slots.length} item${slots.length === 1 ? "" : "s"}, but this scene has ${assets.length}.`;
      }
      for (let k = 0; k < slots.length; k++) {
        const a = assets[k];
        const seconds = Number(slots[k].seconds);
        if (!a || typeof a.url !== "string" || !a.url) return `${label}: item ${k + 1} is missing its link.`;
        if (a.type !== "image" && a.type !== "clip") return `${label}: item ${k + 1} is not an image or a clip.`;
        if (!templateAccepts(t, a.type)) {
          return `${label}: "${t.label}" takes ${t.kind}s, but item ${k + 1} is a ${a.type}.`;
        }
        if (a.type === "clip") {
          if (typeof a.start !== "number" || typeof a.end !== "number" || a.start < 0 || a.end <= a.start) {
            return `${label}: clip ${k + 1} needs a start time before its end time.`;
          }
          const windowEnd = typeof a.window_end === "number" && a.window_end > a.end ? a.window_end : a.end;
          if (windowEnd - a.start < seconds - CLIP_SLACK) {
            return `${label}: the chosen part of clip ${k + 1} is ${(windowEnd - a.start).toFixed(1)}s, shorter than its ${seconds}s slot in "${t.label}".`;
          }
          cleaned.push({ ...a, end: round2(a.start + seconds), window_end: round2(windowEnd) });
        } else {
          cleaned.push({ type: "image", url: a.url, ...(a.description ? { description: a.description } : {}) });
        }
      }
    }

    out.push({ n: i + 1, template: t.key, kind: t.kind, duration, caption, assets: cleaned });
  }
  return out;
}
