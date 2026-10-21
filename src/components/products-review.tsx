"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Film, Loader2, Play, Plus, RefreshCw, RotateCcw, SkipForward, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatSeconds, parseTimeToSeconds } from "@/lib/repurpose-utils";
import type { ProductClipStatus, ProductEntry } from "@/lib/types";

interface Match {
  title: string;
  asin: string;
  url?: string;
}
interface Candidate {
  video_index: number;
  name: string;
  mention?: string;
  start?: number | null;
  end?: number | null;
  status?: string;
  suggested?: number | null;
  reason?: string;
  matches?: Match[];
}
interface Detail {
  id: string;
  title: string;
  status: string;
  products_step: "extracting" | "review" | "confirmed" | null;
  shop_status: string | null;
  sources: { index: number; url: string | null; original_url: string | null; kind: string | null }[];
  timing: { index: number; error: string | null; segments: { start: number; end: number; text: string }[] }[];
  items: ProductEntry[];
  candidates: Candidate[];
}
interface EditRow {
  key: string;
  asin: string;
  name: string;
  videoIndex: number | null;
  start: string;
  end: string;
  noClip: boolean;
  recut: boolean;
  clip?: ProductClipStatus;
  clipError?: string | null;
  matches: Match[];
  reason?: string;
}

const CLIP_CHIP: Record<ProductClipStatus, { label: string; cls: string }> = {
  pending: { label: "Clip waiting", cls: "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]" },
  done: { label: "Clip ready", cls: "bg-[var(--color-green-soft)] text-[var(--color-green)] border-[var(--color-green)]/30" },
  error: { label: "Clip failed", cls: "bg-[var(--color-red-soft)] text-[var(--color-red)] border-[var(--color-red)]/40" },
  exists: { label: "Already in shop", cls: "bg-[var(--color-green-soft)] text-[var(--color-green)] border-[var(--color-green)]/30" },
  none: { label: "No clip", cls: "bg-[var(--surface)] text-[var(--text-faint)] border-[var(--border)]" },
};

let keySeq = 0;
const nextKey = () => `r${++keySeq}`;
const INPUT = "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text)] disabled:opacity-50";

function toRows(d: Detail): EditRow[] {
  const rows: EditRow[] = d.items.map((p) => ({
    key: nextKey(),
    asin: p.asin,
    name: p.name ?? "",
    videoIndex: typeof p.video_index === "number" ? p.video_index : null,
    start: typeof p.start === "number" ? formatSeconds(p.start) : "",
    end: typeof p.end === "number" ? formatSeconds(p.end) : "",
    noClip: p.clip === "none",
    recut: false,
    clip: p.clip,
    clipError: p.clip_error,
    matches: [],
  }));
  const have = new Set(rows.map((r) => r.asin));
  for (const c of d.candidates) {
    const matches = (c.matches ?? []).filter((m) => m && m.asin);
    const pick = typeof c.suggested === "number" ? matches[c.suggested] : undefined;
    if (pick && have.has(pick.asin)) continue;
    rows.push({
      key: nextKey(),
      asin: pick?.asin ?? "",
      name: pick?.title ?? c.name,
      videoIndex: c.video_index,
      start: typeof c.start === "number" ? formatSeconds(c.start) : "",
      end: typeof c.end === "number" ? formatSeconds(c.end) : "",
      noClip: false,
      recut: false,
      matches,
      reason: c.reason,
    });
  }
  return rows.sort((a, b) => (a.videoIndex ?? 99) - (b.videoIndex ?? 99) || (parseTimeToSeconds(a.start) ?? 0) - (parseTimeToSeconds(b.start) ?? 0));
}

export function ProductEditor({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "confirm" | "extract" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stopAt = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const markDirty = (v: boolean) => {
    dirtyRef.current = v;
    setDirty(v);
  };

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/repurpose/${id}/products`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load this item.");
      setDetail(data as Detail);
      // Never throw away what is being typed: rows are only rebuilt from the server while nothing is edited.
      if (!dirtyRef.current) setRows(toRows(data as Detail));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this item.");
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch for this item
    void load();
  }, [load]);

  const working = detail?.products_step === "extracting" || rows.some((r) => r.clip === "pending");
  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [working, load]);

  const patch = (key: string, p: Partial<EditRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
    markDirty(true);
  };
  const remove = (key: string) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    markDirty(true);
  };
  const add = () => {
    setRows((rs) => [...rs, { key: nextKey(), asin: "", name: "", videoIndex: detail?.sources[0]?.index ?? 0, start: "", end: "", noClip: false, recut: false, matches: [] }]);
    markDirty(true);
  };

  const source = detail?.sources.find((s) => s.index === activeVideo) ?? detail?.sources[0];

  const grab = (row: EditRow, field: "start" | "end") => {
    const v = videoRef.current;
    if (row.videoIndex === null) return setNotice("Choose the video for this product first.");
    if (row.videoIndex !== activeVideo) {
      setActiveVideo(row.videoIndex);
      return setNotice(`Player switched to video ${row.videoIndex + 1} - find the moment, then press the button again.`);
    }
    if (!v) return;
    patch(row.key, { [field]: formatSeconds(Math.round(v.currentTime * 10) / 10) } as Partial<EditRow>);
    setNotice(null);
  };
  const playWindow = (row: EditRow) => {
    const s = parseTimeToSeconds(row.start);
    const e = parseTimeToSeconds(row.end);
    if (row.videoIndex === null || s === null) return setNotice("Set the video and a start time first.");
    if (row.videoIndex !== activeVideo) {
      setActiveVideo(row.videoIndex);
      return setNotice(`Player switched to video ${row.videoIndex + 1} - press play window again.`);
    }
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = s;
    stopAt.current = e;
    void v.play();
  };

  const heard = (row: EditRow): string => {
    const s = parseTimeToSeconds(row.start);
    const e = parseTimeToSeconds(row.end);
    const t = detail?.timing.find((x) => x.index === row.videoIndex);
    if (!t || s === null) return "";
    const segs = t.segments.filter((g) => g.end > s && g.start < (e ?? s + 1));
    return segs.slice(0, 2).map((g) => g.text).join(" ");
  };

  const submit = async (action: "save" | "confirm") => {
    setError(null);
    setNotice(null);
    const items: Array<Record<string, unknown>> = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const s = r.start.trim() ? parseTimeToSeconds(r.start) : null;
      const e = r.end.trim() ? parseTimeToSeconds(r.end) : null;
      if (r.start.trim() && s === null) return setError(`Product ${i + 1}: "${r.start}" is not a valid start time (use 1:23 or 83.5).`);
      if (r.end.trim() && e === null) return setError(`Product ${i + 1}: "${r.end}" is not a valid end time (use 1:23 or 83.5).`);
      items.push({ asin: r.asin, name: r.name, video_index: r.videoIndex, start: s, end: e, no_clip: r.noClip, recut: r.recut });
    }
    setBusy(action);
    try {
      const res = await fetch(`/api/repurpose/${id}/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, items }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      markDirty(false);
      setNotice(action === "confirm" ? "Confirmed - clips are being cut." : "Saved.");
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  };

  const clipAction = async (asin: string, action: "retry" | "skip") => {
    setError(null);
    try {
      const res = await fetch(`/api/repurpose/${id}/products/clip`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asin, action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not do that.");
      markDirty(false);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not do that.");
    }
  };

  const extractAgain = async () => {
    setBusy("extract");
    setError(null);
    try {
      const res = await fetch(`/api/repurpose/${id}/products/extract`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the search.");
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the search.");
    } finally {
      setBusy(null);
    }
  };

  if (!detail) {
    return (
      <div className="px-5 py-6 text-xs text-[var(--text-faint)] flex items-center gap-2">
        {error ? <span className="text-[var(--color-red)]">{error}</span> : <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>}
      </div>
    );
  }

  const noSound = detail.timing.length === 0 || detail.timing.every((t) => t.segments.length === 0);

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-raised)]/40 px-4 sm:px-5 py-4 space-y-4">
      {detail.products_step === "extracting" && (
        <p className="text-xs text-[var(--text-muted)] flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the transcript and searching the site for the products… they appear here when ready. You can also add them by hand below.
        </p>
      )}
      {noSound && detail.products_step !== "extracting" && (
        <p className="text-xs text-[var(--text-muted)]">No speech was found in these videos, so nothing could be read automatically - add each product by hand with its video and start/end time.</p>
      )}

      {/* player */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Film className="w-3.5 h-3.5 text-[var(--text-faint)]" />
          {detail.sources.map((s) => (
            <button
              key={s.index}
              type="button"
              onClick={() => setActiveVideo(s.index)}
              className={cn("px-2.5 py-1 rounded-lg border text-xs font-medium", s.index === (source?.index ?? 0) ? "border-[var(--color-purple)] text-[var(--color-purple)]" : "border-[var(--border)] text-[var(--text-muted)]")}
            >
              Video {s.index + 1}
            </button>
          ))}
        </div>
        {source?.url ? (
          <video
            ref={videoRef}
            key={source.url}
            src={source.url}
            controls
            preload="metadata"
            className="w-full max-h-[340px] rounded-lg bg-black"
            onTimeUpdate={(e) => {
              if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) {
                e.currentTarget.pause();
                stopAt.current = null;
              }
            }}
          />
        ) : (
          <p className="text-xs text-[var(--text-faint)]">This video has no playable link yet.</p>
        )}
        {notice && <p className="text-xs text-[var(--color-purple)]">{notice}</p>}
      </div>

      {/* products */}
      <div className="space-y-3">
        {rows.length === 0 && <p className="text-xs text-[var(--text-faint)]">No products yet.</p>}
        {rows.map((r, i) => {
          const done = r.clip === "done" && !r.recut;
          const exists = r.clip === "exists";
          const chip = r.clip ? CLIP_CHIP[r.clip] : null;
          const hint = heard(r);
          return (
            <div key={r.key} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Product {i + 1}</span>
                {chip && <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", chip.cls)}>{chip.label}</span>}
                <button type="button" onClick={() => remove(r.key)} className="ml-auto text-[var(--text-faint)] hover:text-[var(--color-red)]" aria-label="Remove product">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {r.matches.length > 0 && (
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Matches found on the site{r.reason ? ` - ${r.reason}` : ""}</label>
                  <select
                    className={INPUT}
                    value={r.matches.find((m) => m.asin === r.asin)?.asin ?? ""}
                    onChange={(e) => {
                      const m = r.matches.find((x) => x.asin === e.target.value);
                      if (m) patch(r.key, { asin: m.asin, name: m.title });
                    }}
                  >
                    <option value="">Pick the right one…</option>
                    {r.matches.map((m) => (
                      <option key={m.asin} value={m.asin}>{m.title} ({m.asin})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">ASIN or Amazon link</label>
                  <input className={INPUT} value={r.asin} disabled={done || exists} onChange={(e) => patch(r.key, { asin: e.target.value })} placeholder="B0XXXXXXXX" />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Product name (used as the shop title)</label>
                  <input className={INPUT} value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} placeholder="Name as listed with the ASIN" />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Video</label>
                  <select className={INPUT} disabled={done} value={r.videoIndex ?? ""} onChange={(e) => patch(r.key, { videoIndex: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">Choose…</option>
                    {detail.sources.map((s) => (
                      <option key={s.index} value={s.index}>Video {s.index + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Starts at</label>
                  <input className={INPUT} disabled={done} value={r.start} onChange={(e) => patch(r.key, { start: e.target.value })} placeholder="0:00" />
                  {!done && <button type="button" onClick={() => grab(r, "start")} className="mt-1 text-[10px] text-[var(--color-purple)] hover:underline">use player time</button>}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Ends at</label>
                  <input className={INPUT} disabled={done} value={r.end} onChange={(e) => patch(r.key, { end: e.target.value })} placeholder="0:30" />
                  {!done && <button type="button" onClick={() => grab(r, "end")} className="mt-1 text-[10px] text-[var(--color-purple)] hover:underline">use player time</button>}
                </div>
                <button type="button" onClick={() => playWindow(r)} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface-raised)]">
                  <Play className="w-3.5 h-3.5" /> Play window
                </button>
              </div>

              {hint && <p className="text-[11px] italic text-[var(--text-faint)] line-clamp-2">“{hint}”</p>}

              <div className="flex items-center gap-3 flex-wrap text-xs text-[var(--text-muted)]">
                {!done && !exists && (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={r.noClip} onChange={(e) => patch(r.key, { noClip: e.target.checked })} /> No clip for this product
                  </label>
                )}
                {done && (
                  <button type="button" onClick={() => patch(r.key, { recut: true })} className="inline-flex items-center gap-1 text-[var(--color-purple)] hover:underline">
                    <RefreshCw className="w-3 h-3" /> Edit times and cut again
                  </button>
                )}
                {r.clip === "error" && (
                  <>
                    <span className="text-[var(--color-red)] inline-flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /> {r.clipError || "The clip could not be made."}</span>
                    <button type="button" onClick={() => void clipAction(r.asin, "retry")} className="inline-flex items-center gap-1 text-[var(--color-purple)] hover:underline"><RotateCcw className="w-3 h-3" /> Retry</button>
                    <button type="button" onClick={() => void clipAction(r.asin, "skip")} className="inline-flex items-center gap-1 text-[var(--text-muted)] hover:underline"><SkipForward className="w-3 h-3" /> Create the product without a video</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        <button type="button" onClick={add} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface-raised)]">
          <Plus className="w-3.5 h-3.5" /> Add a product by hand
        </button>
      </div>

      {error && (
        <p className="text-xs text-[var(--color-red)] flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> <span className="break-words">{error}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null || rows.length === 0}
          onClick={() => void submit("confirm")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[var(--color-purple)] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50"
        >
          {busy === "confirm" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {detail.products_step === "confirmed" ? "Save changes" : "Confirm products & start clips"}
        </button>
        {detail.products_step !== "confirmed" && (
          <button type="button" disabled={busy !== null} onClick={() => void submit("save")} className="px-3.5 py-2 rounded-lg border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--surface-raised)] disabled:opacity-50">
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
        )}
        {detail.status === "voice_timing_done" && detail.products_step !== "extracting" && (
          <button type="button" disabled={busy !== null || dirty} onClick={() => void extractAgain()} title={dirty ? "Save your changes first" : undefined} className="ml-auto px-3 py-2 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--surface-raised)] disabled:opacity-50">
            {busy === "extract" ? "Starting…" : "Find products again"}
          </button>
        )}
      </div>
    </div>
  );
}
