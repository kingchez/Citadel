"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvaTemplate, TemplatePurpose } from "@/lib/news-types";
import { LABEL_LEVELS } from "@/lib/news-types";
import { formatTimeAgo } from "@/lib/utils";
import { Copy, LayoutTemplate, Loader2, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";

interface FormSlot {
  field: string;
  kind: "image" | "video";
  seconds: string;
}

interface FormLabel {
  name: string;
  field: string;
  level: string;
  min: string;
  max: string;
  fixed: string;
}

interface Form {
  key: string | null;
  label: string;
  purpose: TemplatePurpose;
  role: "scene" | "intro" | "outro";
  category: string;
  newCategory: string;
  brand: string;
  slots: FormSlot[];
  labels: FormLabel[];
  duration: string;
  width: string;
  height: string;
  active: boolean;
  notes: string;
  usage_count: number;
  last_used_at: string | null;
}

const NEW_CATEGORY = "__new__";
const DEFAULT_LEVELS = ["h1", "h2", "h3"];

function newLabel(index: number): FormLabel {
  const name = `text_${index + 1}`;
  return { name, field: name, level: DEFAULT_LEVELS[index] || "text", min: "0", max: "70", fixed: "" };
}

function newSlot(index: number, purpose: TemplatePurpose): FormSlot {
  return { field: `media_${index + 1}`, kind: purpose === "social" ? "image" : "video", seconds: "3" };
}

function emptyForm(purpose: TemplatePurpose): Form {
  return {
    key: null,
    label: "",
    purpose,
    role: "scene",
    category: "All",
    newCategory: "",
    brand: "",
    slots: [newSlot(0, purpose)],
    labels: [newLabel(0)],
    duration: "2",
    width: "1080",
    height: "1920",
    active: false,
    notes: "",
    usage_count: 0,
    last_used_at: null,
  };
}

function formFromTemplate(t: CanvaTemplate): Form {
  return {
    key: t.key,
    label: t.label,
    purpose: t.purpose,
    role: t.role === "intro" || t.role === "outro" ? t.role : "scene",
    category: t.category || "All",
    newCategory: "",
    brand: t.brand_template_id || "",
    slots: (t.slots || []).map((s) => ({ field: s.field, kind: s.kind, seconds: s.seconds ? String(s.seconds) : "" })),
    labels: (t.labels || []).map((l) => ({
      name: l.name,
      field: l.field,
      level: l.level,
      min: String(l.min_chars),
      max: String(l.max_chars),
      fixed: l.fixed_text || "",
    })),
    duration: t.duration_seconds ? String(t.duration_seconds) : "2",
    width: String(t.media_width || 1080),
    height: String(t.media_height || 1920),
    active: t.active,
    notes: t.notes || "",
    usage_count: t.usage_count || 0,
    last_used_at: t.last_used_at || null,
  };
}

function toPayload(f: Form) {
  const hasSlots = f.purpose === "social" || f.role === "scene";
  return {
    label: f.label,
    purpose: f.purpose,
    role: f.purpose === "social" ? "post" : f.role,
    category: f.category === NEW_CATEGORY ? f.newCategory.trim() : f.category,
    brand_template_id: f.brand,
    slots: hasSlots
      ? f.slots.map((s) =>
          f.purpose === "social" ? { field: s.field, kind: "image" } : { field: s.field, kind: s.kind, seconds: Number(s.seconds) }
        )
      : [],
    labels: f.labels.map((l) => ({
      name: l.name,
      field: l.field,
      level: l.level,
      min_chars: Number(l.min),
      max_chars: Number(l.max),
      fixed_text: l.fixed,
    })),
    duration_seconds: Number(f.duration),
    media_width: Number(f.width),
    media_height: Number(f.height),
    active: f.active,
    notes: f.notes,
  };
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | TemplatePurpose>("all");
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/news/templates")
      .then((r) => r.json())
      .then((data: { templates?: CanvaTemplate[]; categories?: string[] }) => {
        setTemplates(data.templates || []);
        setCategories(data.categories || ["All"]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const patch = (changes: Partial<Form>) => setForm((f) => (f ? { ...f, ...changes } : f));
  const editSlot = (i: number, changes: Partial<FormSlot>) =>
    setForm((f) => (f ? { ...f, slots: f.slots.map((s, j) => (j === i ? { ...s, ...changes } : s)) } : f));
  const editLabel = (i: number, changes: Partial<FormLabel>) =>
    setForm((f) => (f ? { ...f, labels: f.labels.map((l, j) => (j === i ? { ...l, ...changes } : l)) } : f));

  const save = async () => {
    if (!form) return;
    setBusy("save");
    try {
      const res = await fetch(form.key ? `/api/news/templates/${form.key}` : "/api/news/templates", {
        method: form.key ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      showFeedback("Template saved.");
      setForm(null);
      load();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!form?.key) return;
    if (!window.confirm(`Delete "${form.label}"? This can't be undone.`)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/news/templates/${form.key}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not delete.");
      showFeedback("Template deleted.");
      setForm(null);
      load();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(null);
    }
  };

  const resetUsage = async () => {
    if (!form?.key) return;
    setBusy("reset");
    try {
      const res = await fetch(`/api/news/templates/${form.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_usage" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not reset.");
      patch({ usage_count: 0, last_used_at: null });
      showFeedback("Use count reset.");
      load();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setBusy(null);
    }
  };

  const shown = templates.filter((t) => filter === "all" || t.purpose === filter);
  const hasSlotsEditor = form ? form.purpose === "social" || form.role === "scene" : false;
  const slotTotal = form ? form.slots.reduce((sum, s) => sum + (Number(s.seconds) || 0), 0) : 0;

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutTemplate className="w-5 h-5 text-[var(--color-purple)]" />
          <h1 className="text-lg font-semibold text-[var(--text)]">Templates</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "video", "social"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                filter === f ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)] text-[var(--text)]" : "border-[var(--border)] text-[var(--text-muted)]"
              }`}
            >
              {f === "all" ? "All" : f === "video" ? "Video" : "Social"}
            </button>
          ))}
          <button onClick={() => setForm(emptyForm("video"))} className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            New template
          </button>
        </div>
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down max-w-sm">
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      {form && (
        <div className="card p-4 sm:p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">{form.key ? "Edit template" : "New template"}</h2>
            <button onClick={() => setForm(null)} className="btn-ghost p-1.5" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-faint)]">Name</span>
              <input value={form.label} onChange={(e) => patch({ label: e.target.value })} className="input-field text-sm py-2 w-full" placeholder="e.g. Two images, one headline" />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-[var(--text-faint)]">Canva template ID</span>
              <input value={form.brand} onChange={(e) => patch({ brand: e.target.value })} className="input-field text-sm py-2 w-full" placeholder="Brand template ID from Canva" />
            </label>

            <div className="space-y-1">
              <span className="text-xs text-[var(--text-faint)]">For</span>
              <div className="grid grid-cols-2 gap-2">
                {(["video", "social"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() =>
                      patch({
                        purpose: p,
                        slots: form.slots.map((s) => ({ ...s, kind: p === "social" ? "image" : s.kind })),
                      })
                    }
                    className={`text-sm py-2 rounded-lg border ${
                      form.purpose === p ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)]" : "border-[var(--border)]"
                    }`}
                  >
                    {p === "video" ? "Video" : "Social post"}
                  </button>
                ))}
              </div>
            </div>

            {form.purpose === "video" && (
              <label className="space-y-1">
                <span className="text-xs text-[var(--text-faint)]">Role in the video</span>
                <select value={form.role} onChange={(e) => patch({ role: e.target.value as Form["role"] })} className="input-field text-sm py-2 w-full">
                  <option value="scene">Scene</option>
                  <option value="intro">Intro</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
            )}

            <label className="space-y-1">
              <span className="text-xs text-[var(--text-faint)]">Category it serves</span>
              <select value={form.category} onChange={(e) => patch({ category: e.target.value })} className="input-field text-sm py-2 w-full">
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All categories" : c}
                  </option>
                ))}
                {!categories.includes(form.category) && form.category !== NEW_CATEGORY && <option value={form.category}>{form.category}</option>}
                <option value={NEW_CATEGORY}>+ Add a new category…</option>
              </select>
              {form.category === NEW_CATEGORY && (
                <input value={form.newCategory} onChange={(e) => patch({ newCategory: e.target.value })} className="input-field text-sm py-2 w-full mt-2" placeholder="New category name" />
              )}
            </label>

            {form.purpose === "video" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs text-[var(--text-faint)]">Media width</span>
                  <input value={form.width} onChange={(e) => patch({ width: e.target.value })} className="input-field text-sm py-2 w-full" inputMode="numeric" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs text-[var(--text-faint)]">Media height</span>
                  <input value={form.height} onChange={(e) => patch({ height: e.target.value })} className="input-field text-sm py-2 w-full" inputMode="numeric" />
                </label>
              </div>
            )}
          </div>

          {hasSlotsEditor && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text)]">{form.purpose === "social" ? "Images" : "Images and videos"}</h3>
                {form.purpose === "video" && (
                  <span className="text-xs text-[var(--text-faint)]">Template length: {slotTotal > 0 ? `${slotTotal}s` : "—"}</span>
                )}
              </div>
              {form.slots.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input value={s.field} onChange={(e) => editSlot(i, { field: e.target.value })} className="input-field text-sm py-2 col-span-5 sm:col-span-5" placeholder="Canva field" />
                  {form.purpose === "video" ? (
                    <>
                      <select value={s.kind} onChange={(e) => editSlot(i, { kind: e.target.value as FormSlot["kind"] })} className="input-field text-sm py-2 col-span-4 sm:col-span-3">
                        <option value="video">Video</option>
                        <option value="image">Image</option>
                      </select>
                      <input value={s.seconds} onChange={(e) => editSlot(i, { seconds: e.target.value })} className="input-field text-sm py-2 col-span-2 sm:col-span-3" inputMode="decimal" placeholder="sec" />
                    </>
                  ) : (
                    <span className="col-span-6 text-xs text-[var(--text-faint)]">Image</span>
                  )}
                  <button
                    onClick={() => setForm((f) => (f ? { ...f, slots: f.slots.filter((_, j) => j !== i) } : f))}
                    className="btn-ghost p-1.5 col-span-1 text-[var(--color-red)]"
                    aria-label="Remove slot"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => setForm((f) => (f ? { ...f, slots: [...f.slots, newSlot(f.slots.length, f.purpose)] } : f))}
                className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add {form.purpose === "social" ? "image" : "image or video"}
              </button>
            </div>
          )}

          {form.purpose === "video" && !hasSlotsEditor && (
            <label className="space-y-1 block max-w-xs">
              <span className="text-xs text-[var(--text-faint)]">How long this card lasts (seconds)</span>
              <input value={form.duration} onChange={(e) => patch({ duration: e.target.value })} className="input-field text-sm py-2 w-full" inputMode="decimal" />
            </label>
          )}

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text)]">Text labels</h3>
            {form.labels.length === 0 && <p className="text-xs text-[var(--text-faint)]">No text. Add a label if this template shows text.</p>}
            {form.labels.map((l, i) => (
              <div key={i} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <input value={l.name} onChange={(e) => editLabel(i, { name: e.target.value })} className="input-field text-sm py-2 col-span-12 sm:col-span-4" placeholder="Label name" />
                  <input value={l.field} onChange={(e) => editLabel(i, { field: e.target.value })} className="input-field text-sm py-2 col-span-12 sm:col-span-3" placeholder="Canva field" />
                  <select value={l.level} onChange={(e) => editLabel(i, { level: e.target.value })} className="input-field text-sm py-2 col-span-4 sm:col-span-2">
                    {LABEL_LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {lv}
                      </option>
                    ))}
                  </select>
                  <input value={l.min} onChange={(e) => editLabel(i, { min: e.target.value })} className="input-field text-sm py-2 col-span-3 sm:col-span-1" inputMode="numeric" placeholder="min" />
                  <input value={l.max} onChange={(e) => editLabel(i, { max: e.target.value })} className="input-field text-sm py-2 col-span-3 sm:col-span-1" inputMode="numeric" placeholder="max" />
                  <button
                    onClick={() => setForm((f) => (f ? { ...f, labels: f.labels.filter((_, j) => j !== i) } : f))}
                    className="btn-ghost p-1.5 col-span-2 sm:col-span-1 text-[var(--color-red)]"
                    aria-label="Remove label"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <input
                  value={l.fixed}
                  onChange={(e) => editLabel(i, { fixed: e.target.value })}
                  className="input-field text-sm py-2 w-full"
                  placeholder="Fixed text (optional): always used as-is instead of AI text"
                />
              </div>
            ))}
            <button
              onClick={() => setForm((f) => (f ? { ...f, labels: [...f.labels, newLabel(f.labels.length)] } : f))}
              className="btn-secondary text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add text label
            </button>
          </div>

          <label className="space-y-1 block">
            <span className="text-xs text-[var(--text-faint)]">Notes</span>
            <textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={2} className="input-field text-sm w-full" />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
              <input type="checkbox" checked={form.active} onChange={(e) => patch({ active: e.target.checked })} />
              Active (the planner may use it)
            </label>
            {form.key && (
              <span className="text-xs text-[var(--text-faint)]">
                Used {form.usage_count} time{form.usage_count === 1 ? "" : "s"}
                {form.last_used_at ? ` · last ${formatTimeAgo(form.last_used_at)}` : ""}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {form.key && (
              <>
                <button onClick={remove} disabled={busy !== null} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 text-[var(--color-red)] disabled:opacity-50">
                  {busy === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
                <button onClick={resetUsage} disabled={busy !== null} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50">
                  <RotateCcw className="w-4 h-4" />
                  Reset use count
                </button>
                <button
                  onClick={() => setForm({ ...form, key: null, label: `${form.label} copy`, active: false, usage_count: 0, last_used_at: null })}
                  disabled={busy !== null}
                  className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <Copy className="w-4 h-4" />
                  Duplicate
                </button>
              </>
            )}
            <button
              onClick={save}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 py-2 px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
          </div>
        </div>
      )}

      {shown.length === 0 && !form && (
        <div className="card p-6 text-center text-[var(--text-muted)] text-sm">No templates yet. Use “New template” to add one.</div>
      )}

      <div className="space-y-3">
        {shown.map((t) => (
          <div key={t.key} className="card p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-[var(--text)]">{t.label}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="badge badge-purple">{t.purpose === "video" ? "Video" : "Social"}</span>
                {t.role !== "post" && <span className="badge badge-cyan">{t.role}</span>}
                <span className="badge badge-amber">{t.category === "All" ? "All categories" : t.category}</span>
                <span className={`badge ${t.active ? "badge-green" : "badge-red"}`}>{t.active ? "Active" : "Off"}</span>
              </div>
              <p className="text-xs text-[var(--text-faint)]">
                {(t.slots || []).length} media · {(t.labels || []).length} text{(t.labels || []).length === 1 ? "" : "s"}
                {t.duration_seconds ? ` · ${t.duration_seconds}s` : ""} · used {t.usage_count}×
              </p>
            </div>
            <button onClick={() => setForm(formFromTemplate(t))} className="btn-secondary text-sm py-1.5 px-4">
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
