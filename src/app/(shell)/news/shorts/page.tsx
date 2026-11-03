"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CanvaTemplate, NewsShort, Scene } from "@/lib/news-types";
import { NEWS_SHORT_STATUS_COLORS, NEWS_SHORT_STATUS_LABELS, formatTimecode } from "@/lib/news-types";
import { clipWindow, slotAccepts, textsForTemplate } from "@/lib/news-scenes";
import { formatTimeAgo } from "@/lib/utils";
import { ArrowDown, ArrowUp, CheckCircle2, Film, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";

type Action = "retry" | "save_plan" | "approve" | "replan";

function summarize(short: NewsShort): string {
  const media = short.media || [];
  const clips = media.filter((m) => m.type === "clip").length;
  const images = media.length - clips;
  const parts = [];
  if (clips) parts.push(`${clips} clip${clips === 1 ? "" : "s"}`);
  if (images) parts.push(`${images} image${images === 1 ? "" : "s"}`);
  return parts.join(", ");
}

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

export default function NewsShortsPage() {
  const [shorts, setShorts] = useState<NewsShort[]>([]);
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Scene[]>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/news/shorts")
      .then((r) => r.json())
      .then((data: { shorts?: NewsShort[] }) => setShorts(data.shorts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    fetch("/api/news/templates")
      .then((r) => r.json())
      .then((data: { templates?: CanvaTemplate[] }) => setTemplates(data.templates || []))
      .catch(() => {});
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const scenesOf = (s: NewsShort): Scene[] => drafts[s.id] || s.scenes || [];
  const setScenes = (id: string, scenes: Scene[]) => setDrafts((prev) => ({ ...prev, [id]: scenes }));

  const editScene = (s: NewsShort, i: number, patch: Partial<Scene>) =>
    setScenes(s.id, scenesOf(s).map((sc, j) => (j === i ? { ...sc, ...patch } : sc)));

  const changeTemplate = (s: NewsShort, i: number, key: string) => {
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    const sc = scenesOf(s)[i];
    const assets = sc.assets.map((asset, k) =>
      asset.type === "clip" && t.slots?.[k]
        ? { ...asset, window_end: asset.window_end ?? asset.end, end: Math.round(((asset.start ?? 0) + Number(t.slots[k].seconds || 0)) * 100) / 100 }
        : asset
    );
    editScene(s, i, { template: t.key, role: t.role as Scene["role"], duration: Number(t.duration_seconds || 0), assets, texts: textsForTemplate(t, sc.texts) });
  };

  const editText = (s: NewsShort, i: number, k: number, text: string) => {
    const sc = scenesOf(s)[i];
    editScene(s, i, { texts: sc.texts.map((t, j) => (j === k ? { ...t, text } : t)) });
  };

  const move = (s: NewsShort, i: number, dir: -1 | 1) => {
    const list = [...scenesOf(s)];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    setScenes(s.id, list);
  };

  const run = async (s: NewsShort, action: Action, okMessage: string) => {
    setBusy(`${s.id}:${action}`);
    try {
      const body: Record<string, unknown> = { action };
      if ((action === "save_plan" || action === "approve") && drafts[s.id]) body.scenes = drafts[s.id];
      const res = await fetch(`/api/news/shorts/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "That didn't work.");
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
      showFeedback(okMessage);
      load();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <div className="p-4 sm:p-6 max-w-4xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Film className="w-5 h-5 text-[var(--color-purple)]" />
        <h1 className="text-lg font-semibold text-[var(--text)]">Shorts</h1>
        <span className="text-xs text-[var(--text-faint)]">Canva videos without voice-over</span>
      </div>

      {feedback && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 flex items-center gap-3 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down max-w-sm">
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      {shorts.length === 0 && (
        <div className="card p-6 text-center text-[var(--text-muted)] text-sm">
          No shorts yet. They appear here when an approved video event has no voice-over.
        </div>
      )}

      {shorts.map((s) => {
        const color = NEWS_SHORT_STATUS_COLORS[s.status];
        const scenes = scenesOf(s);
        const editing = s.status === "plan_ready";
        const total = scenes.reduce((sum, sc) => sum + Number(sc.duration || 0), 0);

        return (
          <div key={s.id} className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <Link
                  href={`/news/events/${s.event_id}`}
                  className="text-sm font-semibold text-[var(--text)] hover:text-[var(--color-purple)]"
                >
                  {s.headline || s.events?.event_title || `Event #${s.event_id}`}
                </Link>
                <p className="text-xs text-[var(--text-faint)] mt-0.5">
                  {summarize(s)}
                  {scenes.length > 0 ? ` · ${scenes.length} scenes, ${formatTimecode(total)}` : ""} · {formatTimeAgo(s.updated_at)}
                </p>
              </div>
              <span className={`badge badge-${color}`}>{NEWS_SHORT_STATUS_LABELS[s.status]}</span>
            </div>

            {s.error && <p className="text-sm text-[var(--color-red)]">{s.error}</p>}

            {editing && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-[var(--text)]">Scene plan — check the captions, then approve</p>
                {templates.filter((t) => t.active && t.brand_template_id).length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">
                    No Canva templates are active yet. Add them on the Templates page.
                  </p>
                )}
                {scenes.map((sc, i) => {
                  const tpl = templates.find((t) => t.key === sc.template);
                  const options = optionsFor(sc, templates);
                  return (
                    <div key={`${s.id}-${i}`} className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono text-[var(--text-faint)] w-14">Scene {i + 1}</span>
                        <select
                          value={sc.template}
                          onChange={(e) => changeTemplate(s, i, e.target.value)}
                          className="input-field text-sm py-1.5 flex-1 min-w-[10rem]"
                        >
                          {!options.some((o) => o.key === sc.template) && <option value={sc.template}>{sc.template}</option>}
                          {options.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button onClick={() => move(s, i, -1)} disabled={i === 0} className="btn-ghost p-1.5 disabled:opacity-30" aria-label="Move up">
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => move(s, i, 1)}
                          disabled={i === scenes.length - 1}
                          className="btn-ghost p-1.5 disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setScenes(s.id, scenes.filter((_, j) => j !== i))}
                          className="btn-ghost p-1.5 text-[var(--color-red)]"
                          aria-label="Remove scene"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {sc.assets.map((asset, k) => (
                        <div key={`${s.id}-${i}-a${k}`} className="flex items-center gap-3">
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
                          <div key={`${s.id}-${i}-t${k}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-medium text-[var(--text-muted)]">{tx.name}</span>
                              <span className="text-[10px] uppercase text-[var(--text-faint)]">{tx.level}</span>
                              {fixed && <span className="text-[10px] text-[var(--text-faint)]">fixed text</span>}
                            </div>
                            <textarea
                              value={tx.text}
                              onChange={(e) => editText(s, i, k, e.target.value)}
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
                  <button
                    onClick={() => run(s, "replan", "Sent back to the planner.")}
                    disabled={busy !== null}
                    className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Re-plan
                  </button>
                  {drafts[s.id] && (
                    <button
                      onClick={() => run(s, "save_plan", "Plan saved.")}
                      disabled={busy !== null}
                      className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      Save changes
                    </button>
                  )}
                  <button
                    onClick={() => run(s, "approve", "Plan approved — it will be cut and designed in Canva.")}
                    disabled={busy !== null || scenes.length === 0}
                    className="inline-flex items-center gap-2 py-2 px-5 rounded-xl bg-[var(--color-green)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {busy === `${s.id}:approve` ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Approve plan
                  </button>
                </div>
              </div>
            )}

            {!editing && scenes.length > 0 && (
              <ol className="space-y-1 text-sm">
                {scenes.map((sc, i) => (
                  <li key={`${s.id}-r-${i}`} className="text-[var(--text-muted)]">
                    <span className="text-[var(--text-faint)]">
                      {i + 1}. {sc.template}
                    </span>{" "}
                    {sc.texts.map((tx) => tx.text).filter(Boolean).join(" · ")}
                  </li>
                ))}
              </ol>
            )}

            {s.export_url && (
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Final video</p>
                <video src={s.export_url} controls preload="metadata" className="w-full max-w-sm max-h-96 rounded-lg bg-black" />
              </div>
            )}

            {s.status === "error" && (
              <button
                onClick={() => run(s, "retry", "Back in the queue.")}
                disabled={busy !== null}
                className="btn-secondary text-sm py-2 px-4 inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy === `${s.id}:retry` ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Retry
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
