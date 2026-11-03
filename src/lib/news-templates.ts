import { LABEL_LEVELS } from "@/lib/news-types";
import type { TemplateLabel, TemplatePurpose, TemplateRole, TemplateSlot } from "@/lib/news-types";

/** The editable fields of a template, checked and cleaned. */
export interface TemplateInput {
  label: string;
  purpose: TemplatePurpose;
  role: TemplateRole;
  category: string;
  brand_template_id: string;
  slots: TemplateSlot[];
  labels: TemplateLabel[];
  duration_seconds: number | null;
  media_width: number;
  media_height: number;
  active: boolean;
  notes: string | null;
}

/** A short internal id for a new template. It is not shown and never changes when the label is edited. */
export function makeTemplateKey(label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "template";
  return `${slug}-${Math.random().toString(36).slice(2, 6)}`;
}

function num(v: unknown): number {
  return typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
}

/** Validates the form payload. Returns the cleaned template fields or a message about what to fix. */
export function cleanTemplateInput(body: unknown): TemplateInput | string {
  const b = (body || {}) as Record<string, unknown>;

  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) return "Give the template a name.";
  if (label.length > 120) return "The template name is too long.";

  const purpose = b.purpose === "social" ? "social" : b.purpose === "video" ? "video" : null;
  if (!purpose) return "Choose whether this is a video or a social template.";

  let role: TemplateRole;
  if (purpose === "social") {
    role = "post";
  } else if (b.role === "scene" || b.role === "intro" || b.role === "outro") {
    role = b.role;
  } else {
    return "Choose scene, intro or outro for a video template.";
  }

  const category = typeof b.category === "string" && b.category.trim() ? b.category.trim() : "All";
  const brand = typeof b.brand_template_id === "string" ? b.brand_template_id.trim() : "";
  const active = b.active === true;
  if (active && !brand) return "Add the Canva template ID before turning the template on.";

  // slots
  const rawSlots = Array.isArray(b.slots) ? b.slots : [];
  const slots: TemplateSlot[] = [];
  const slotFields = new Set<string>();
  for (let i = 0; i < rawSlots.length; i++) {
    const s = (rawSlots[i] || {}) as Record<string, unknown>;
    const field = typeof s.field === "string" ? s.field.trim() : "";
    if (!field) return `Slot ${i + 1} needs its Canva field name.`;
    if (slotFields.has(field)) return `Two slots use the field "${field}".`;
    slotFields.add(field);
    const kind = purpose === "social" ? "image" : s.kind === "video" ? "video" : s.kind === "image" ? "image" : null;
    if (!kind) return `Slot ${i + 1}: choose image or video.`;
    if (purpose === "video") {
      const seconds = num(s.seconds);
      if (!(seconds > 0) || seconds > 600) return `Slot ${i + 1} needs its length in seconds.`;
      slots.push({ field, kind, seconds });
    } else {
      slots.push({ field, kind });
    }
  }
  if (role === "scene" && slots.length === 0) return "A video scene template needs at least one image or video slot.";

  // text labels
  const rawLabels = Array.isArray(b.labels) ? b.labels : [];
  const labels: TemplateLabel[] = [];
  const labelFields = new Set<string>();
  for (let i = 0; i < rawLabels.length; i++) {
    const l = (rawLabels[i] || {}) as Record<string, unknown>;
    const name = typeof l.name === "string" && l.name.trim() ? l.name.trim() : `text_${i + 1}`;
    const field = typeof l.field === "string" && l.field.trim() ? l.field.trim() : name;
    if (labelFields.has(field) || slotFields.has(field)) return `The field name "${field}" is used twice.`;
    labelFields.add(field);
    const level = typeof l.level === "string" && (LABEL_LEVELS as readonly string[]).includes(l.level) ? l.level : "text";
    const min = Math.round(num(l.min_chars));
    const max = Math.round(num(l.max_chars));
    if (!Number.isFinite(min) || min < 0) return `"${name}": the minimum length must be 0 or more.`;
    if (!Number.isFinite(max) || max < 1 || max > 2000) return `"${name}": set a maximum length.`;
    if (max < min) return `"${name}": the maximum can't be below the minimum.`;
    const fixed = typeof l.fixed_text === "string" && l.fixed_text.trim() ? l.fixed_text.trim() : null;
    if (fixed && (fixed.length < min || fixed.length > max)) return `"${name}": the fixed text must fit ${min}–${max} characters.`;
    labels.push({ field, name, level, min_chars: min, max_chars: max, ...(fixed ? { fixed_text: fixed } : {}) });
  }

  // duration: the sum of slot seconds, or set by hand for an intro/outro card
  let duration: number | null = null;
  if (purpose === "video") {
    const total = slots.reduce((sum, s) => sum + (s.seconds || 0), 0);
    if (total > 0) {
      duration = total;
    } else {
      const d = num(b.duration_seconds);
      if (!(d > 0) || d > 600) return "Set how long this card lasts, in seconds.";
      duration = d;
    }
  }

  const width = Math.round(num(b.media_width) || 1080);
  const height = Math.round(num(b.media_height) || 1920);
  if (width < 240 || height < 240 || width > 4320 || height > 4320 || width % 2 !== 0 || height % 2 !== 0) {
    return "The media size must be even numbers between 240 and 4320.";
  }

  const notes = typeof b.notes === "string" && b.notes.trim() ? b.notes.trim() : null;

  return { label, purpose, role, category, brand_template_id: brand, slots, labels, duration_seconds: duration, media_width: width, media_height: height, active, notes };
}
