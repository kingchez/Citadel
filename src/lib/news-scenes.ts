import type { CanvaTemplate, Scene, SceneAsset, SceneText, TemplateSlot } from "@/lib/news-types";

/** A clip may be this many seconds shorter than its slot before it is rejected. */
const CLIP_SLACK = 0.25;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whether a slot takes this kind of asset (a video slot takes a clip). */
export function slotAccepts(slot: TemplateSlot, assetType: "image" | "clip"): boolean {
  return slot.kind === "image" ? assetType === "image" : assetType === "clip";
}

/** The longest a clip can be cut for its scene, i.e. the reviewer's chosen window. */
export function clipWindow(a: SceneAsset): number {
  return (a.window_end ?? a.end ?? 0) - (a.start ?? 0);
}

/** Builds the scene texts for a template, keeping what was typed at the same position where it fits. */
export function textsForTemplate(t: CanvaTemplate, previous: SceneText[] = []): SceneText[] {
  return (t.labels || []).map((l, i) => ({
    field: l.field,
    name: l.name,
    level: l.level,
    text: l.fixed_text ? l.fixed_text : previous[i]?.text ?? "",
  }));
}

/**
 * Checks a scene plan against the template table. Returns a cleaned copy (texts
 * taken from the template labels, lengths from the slots, clips cut to their slot
 * length, numbering fixed) or a message saying what is wrong.
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
    if (t.purpose !== "video" || t.role === "post") return `${label}: "${t.label}" is not a video template.`;
    if (!t.active || !t.brand_template_id) return `${label}: the "${t.label}" template is not set up in Canva yet.`;

    // texts: one per label, in order
    const incoming = Array.isArray(s.texts) ? (s.texts as SceneText[]) : [];
    const texts: SceneText[] = [];
    for (let k = 0; k < (t.labels || []).length; k++) {
      const l = t.labels[k];
      const raw = l.fixed_text ? l.fixed_text : typeof incoming[k]?.text === "string" ? incoming[k].text : "";
      const text = raw.trim();
      if (text.length > l.max_chars) {
        return `${label}: "${l.name}" is ${text.length} characters; "${t.label}" allows ${l.min_chars}–${l.max_chars}.`;
      }
      if (text.length < l.min_chars) {
        return `${label}: "${l.name}" is ${text.length} characters; "${t.label}" needs ${l.min_chars}–${l.max_chars}.`;
      }
      texts.push({ field: l.field, name: l.name, level: l.level, text });
    }

    const assets = Array.isArray(s.assets) ? (s.assets as SceneAsset[]) : [];
    const cleaned: SceneAsset[] = [];

    if (t.role === "intro" || t.role === "outro") {
      if (assets.length > 0) return `${label}: an ${t.role} scene has no media.`;
    } else {
      const slots = Array.isArray(t.slots) ? t.slots : [];
      if (slots.length === 0) return `${label}: the "${t.label}" template has no media slots.`;
      if (assets.length !== slots.length) {
        return `${label}: "${t.label}" holds ${slots.length} item${slots.length === 1 ? "" : "s"}, but this scene has ${assets.length}.`;
      }
      for (let k = 0; k < slots.length; k++) {
        const a = assets[k];
        const slot = slots[k];
        if (!a || typeof a.url !== "string" || !a.url) return `${label}: item ${k + 1} is missing its link.`;
        if (a.type !== "image" && a.type !== "clip") return `${label}: item ${k + 1} is not an image or a clip.`;
        if (!slotAccepts(slot, a.type)) {
          return `${label}: slot ${k + 1} of "${t.label}" takes ${slot.kind === "video" ? "a clip" : "an image"}, but item ${k + 1} is ${a.type === "clip" ? "a clip" : "an image"}.`;
        }
        if (a.type === "clip") {
          const seconds = Number(slot.seconds);
          if (!(seconds > 0)) return `${label}: slot ${k + 1} of "${t.label}" has no length in seconds.`;
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

    out.push({ n: i + 1, template: t.key, role: t.role, duration: Number(t.duration_seconds || 0), texts, assets: cleaned });
  }
  return out;
}
