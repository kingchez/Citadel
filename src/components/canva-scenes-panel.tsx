"use client";

import { useEffect, useState } from "react";
import type { CanvaTemplate, MediaItem, Scene } from "@/lib/news-types";
import { formatTimecode } from "@/lib/news-types";
import { clipWindow, slotAccepts, textsForTemplate } from "@/lib/news-scenes";
import type { VideoWithMode } from "@/lib/video-mode";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";

type Action = "retry" | "save_plan" | "approve" | "replan";

const WAITING_TEXT: Record<string, string> = {
  planning: "Waiting for the scene planner. The plan will appear here for your approval.",
  awaiting_media: "Plan approved. The clips are being downloaded and cut.",
  media_ready: "Media is ready. Waiting for Canva to design the scenes.",
  rendering: "Designing the scenes in Canva and joining them with music.",
};

/** Templates a scene may switch to: same role, same number of slots, slots that take its assets, clips long enough. */
function optionsFor(scene: Scene, templates: CanvaTemplate[]): CanvaTemplate[] {
  return templates.filter((t) => {
    if (t.purpose !== "video" || !t.active || !t.brand_template_id) return false;
    if (scene.assets.length === 0) return t.role === scene.role && t.role !== "scene";
    if (t.role !== "scene") return false;
    const slots = t.slots || [];
    if (slots.length !== scene.assets.length) return false;
    return scene.assets.every((a, k) => slotAccepts(slots[k], a.type) && (a.type !== "clip" || Number(slots[k].seconds) <= clipWindow(a) + 0.25));
  });
}

function summarize(media: MediaItem[]): string {
  const clips = media.filter((m) => m.type === "clip").length;
  const images = media.length - clips;
  const parts: string[] = [];
  if (clips) parts.push(`${clips} clip${clips === 1 ? "" : "s"}`);
  if (images) parts.push(`${images} image${images === 1 ? "" : "s"}`);
  return parts.join(", ");
}

/** The Canva scene plan of a voiceless video: review/edit/approve the plan, follow progress, retry failures. */
export function CanvaScenesPanel({ video, onChanged }: { video: VideoWithMode; onChanged: () => void }) {
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [draft, setDraft] = useState<Scene[] | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data: { templates?: CanvaTemplate[] }) => setTemplates(data.templates || []))
      .catch(() => {});
  }, []);

  // Auto-refresh while automation is working on it.
  useEffect(() => {
    if (!WAITING_TEXT[video.status]) return;
    const t = setInterval(onChanged, 15000);
    return () => clearInterval(t);
  }, [video.status, onChanged]);

  const saved = (Array.isArray(video.scenes) ? video.scenes : []) as Scene[];
  const scenes = draft || saved;
  const editing = video.status === "scenes_planned";
  const total = scenes.reduce((sum, sc) => sum + Number(sc.duration || 0), 0);
  const media = (Array.isArray(video.selected_media) ? video.selected_media : []) as MediaItem[];

  const edit = (i: number, patch: Partial<Scene>) => setDraft(scenes.map((sc, j) => (j === i ? { ...sc, ...patch } : sc)));

  const changeTemplate = (i: number, key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    const sc = scenes[i];
    const assets = sc.assets.map((asset, k) =>
      asset.type === "clip" && t.slots?.[k]
        ? { ...asset, window_end: asset.window_end ?? asset.end, end: Math.round(((asset.start ?? 0) + Number(t.slots[k].seconds || 0)) * 100) / 100 }
        : asset
    );
    edit(i, { template: t.key, role: t.role as Scene["role"], duration: Number(t.duration_seconds || 0), assets, texts: textsForTemplate(t, sc.texts) });
  };

  const editText = (i: number, k: number, text: string) => edit(i, { texts: scenes[i].texts.map((t, j) => (j === k ? { ...t, text } : t)) });

  const move = (i: number, dir: -1 | 1) => {
    const list = [...scenes];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setDraft(list);
  };

  const run = async (action: Action, okText: string) => {
    setBusy(action);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { action };
      if ((action === "save_plan" || action === "approve") && draft) body.scenes = draft;
      const res = await fetch(`/api/videos/${video.id}/scenes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setDraft(null);
      setMessage({ ok: true, text: okText });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "That didn't work." });
    } finally {
      setBusy(null);
    }
  };

  const finalUrl = video.status === "done" || video.status === "shipped" ? video.output_drive_link : null;

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-semibold text-[var(--text)]">Canva scenes</h2>
        <span className="text-xs text-[var(--text-faint)]">
          {summarize(media)}
          {scenes.length > 0 ? `${media.length ? " · " : ""}${scenes.length} scenes, ${formatTimecode(total)}` : ""}
        </span>
      </div>

      {WAITING_TEXT[video.status] && <p className="text-sm text-[var(--text-muted)]">{WAITING_TEXT[video.status]}</p>}

      {video.status === "render_error" && (
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/40">
          <AlertTriangle className="w-5 h-5 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-red)] font-mono break-words">{video.error_details || "Something failed."}</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => run("retry", "Back in the queue.")} disabled={busy !== null} className="btn-amber text-xs py-1.5 px-3 inline-flex items-center gap-1.5 disabled:opacity-50">
                {busy === "retry" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Retry
              </button>
              <button onClick={() => run("replan", "Sent back to the planner.")} disabled={busy !== null} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">
                Re-plan from scratch
              </button>
            </div>
          </div>
        </div>
      )}

      {message && <p className={`text-sm ${message.ok ? "text-[var(--color-green)]" : "text-[var(--color-red)]"}`}>{message.text}</p>}

      {editing && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-[var(--text)]">Check the captions and templates, then approve</p>
          {templates.filter((t) => t.active && t.brand_template_id).length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No Canva templates are active yet. Add them on the Templates page.</p>
          )}
          {scenes.map((sc, i) => {
            const tpl = templates.find((t) => t.key === sc.template);
            const options = optionsFor(sc, templates);
            return (
              <div key={`scene-${i}`} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-[var(--text-faint)] w-14">Scene {i + 1}</span>
                  <select value={sc.template} onChange={(e) => changeTemplate(i, e.target.value)} className="input-field text-sm py-1.5 flex-1 min-w-[10rem]">
                    {!options.some((o) => o.key === sc.template) && <option value={sc.template}>{sc.template}</option>}
                    {options.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="btn-ghost p-1.5 disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => move(i, 1)} disabled={i === scenes.length - 1} className="btn-ghost p-1.5 disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDraft(scenes.filter((_, j) => j !== i))} className="btn-ghost p-1.5 text-[var(--color-red)]" aria-label="Remove scene">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {sc.assets.map((asset, k) => (
                  <div key={`scene-${i}-a${k}`} className="flex items-center gap-3">
                    {asset.type === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={asset.url} alt="Scene image" className="h-14 w-20 object-cover rounded-lg flex-shrink-0" />
                    ) : (
                      <span className="text-xs text-[var(--text-faint)] flex-shrink-0">
                        Clip {formatTimecode(asset.start ?? 0)}–{formatTimecode(asset.end ?? 0)}
                      </span>
                    )}
                    {asset.description && <span className="text-xs text-[var(--text-muted)]">{asset.description}</span>}
                  </div>
                ))}

                {sc.texts.map((tx, k) => {
                  const label = tpl?.labels?.[k];
                  const min = label?.min_chars ?? 0;
                  const max = label?.max_chars ?? 200;
                  const len = tx.text.length;
                  const fixed = !!label?.fixed_text;
                  return (
                    <div key={`scene-${i}-t${k}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-medium text-[var(--text-muted)]">{tx.name}</span>
                        <span className="text-[10px] uppercase text-[var(--text-faint)]">{tx.level}</span>
                        {fixed && <span className="text-[10px] text-[var(--text-faint)]">fixed text</span>}
                      </div>
                      <textarea
                        value={tx.text}
                        onChange={(e) => editText(i, k, e.target.value)}
                        rows={tx.level === "h1" || tx.level === "h2" ? 2 : 1}
                        disabled={fixed}
                        className="input-field text-sm w-full disabled:opacity-60"
                        placeholder="On-screen text"
                      />
                      <p className={`text-[11px] text-right ${len > max || len < min ? "text-[var(--color-red)]" : "text-[var(--text-faint)]"}`}>
                        {len} / {min}–{max}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button onClick={() => run("replan", "Sent back to the planner.")} disabled={busy !== null} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50">
              <RotateCcw className="w-4 h-4" />
              Re-plan
            </button>
            {draft && (
              <button onClick={() => run("save_plan", "Plan saved.")} disabled={busy !== null} className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50">
                <Save className="w-4 h-4" />
                Save changes
              </button>
            )}
            <button
              onClick={() => run("approve", "Plan approved. It will be cut and designed in Canva.")}
              disabled={busy !== null || scenes.length === 0}
              className="inline-flex items-center gap-2 py-2 px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approve plan
            </button>
          </div>
        </div>
      )}

      {!editing && scenes.length > 0 && (
        <ol className="space-y-1 text-sm">
          {scenes.map((sc, i) => (
            <li key={`r-${i}`} className="text-[var(--text-muted)]">
              <span className="text-[var(--text-faint)]">
                {i + 1}. {sc.template}
              </span>{" "}
              {sc.texts.map((tx) => tx.text).filter(Boolean).join(" · ")}
            </li>
          ))}
        </ol>
      )}

      {finalUrl && (
        <div className="space-y-1">
          <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Final video</p>
          {finalUrl.startsWith("http") ? (
            <video src={finalUrl} controls preload="metadata" className="w-full max-w-sm max-h-96 rounded-lg bg-black" />
          ) : (
            <p className="text-sm text-[var(--text-muted)] font-mono break-all">{finalUrl}</p>
          )}
        </div>
      )}
    </div>
  );
}
