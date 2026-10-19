"use client";

import { useState } from "react";
import { Check, ExternalLink, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractAsin } from "@/lib/amazon";

interface Candidate {
  title: string;
  asin: string;
  url: string;
}
interface Result {
  name: string;
  status: "exact" | "pick" | "none";
  /** Index into candidates the workflow would pick, or null when it can't decide. */
  suggested: number | null;
  reason?: string;
  candidates: Candidate[];
}
interface Row extends Result {
  chosen: number | null;
  confirmed: boolean;
  paste: string;
}

const BADGE = {
  exact: ["Exact match", "bg-[var(--color-green-soft)] text-[var(--color-green)]"],
  pick: ["Pick one", "bg-[var(--color-amber-soft)] text-[var(--color-amber)]"],
  none: ["Not found", "bg-[var(--color-red-soft)] text-[var(--color-red)]"],
} as const;

/** Adds ASINs under what is already in the Affiliate products box, skipping ones already there. */
export function addAsins(existing: string, asins: string[]): string {
  const have = new Set(existing.split(/[\n,]+/).map((l) => extractAsin(l)));
  const fresh = asins.filter((a) => !have.has(a));
  if (fresh.length === 0) return existing;
  return (existing.trim() ? existing.replace(/\s+$/, "") + "\n" : "") + fresh.join("\n");
}

/**
 * "Find products from script": paste the script, press Search. Citadel hands it to the n8n Product Search workflow,
 * which extracts the product names, searches the channel's website(s) and answers per product. Each answer shows
 * here to confirm; confirmed ASINs go into the Affiliate products box above the queue button.
 */
export function ProductSearch({ channelId, onAsins }: { channelId: string | null; onAsins: (asins: string[]) => void }) {
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const search = async () => {
    setBusy(true);
    setError(null);
    setRows([]);
    try {
      const res = await fetch("/api/product-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script, channel_id: channelId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed.");
      const results: Result[] = Array.isArray(data.products) ? data.products : [];
      if (results.length === 0) throw new Error("No products came back.");
      setRows(results.map((r) => ({ ...r, candidates: r.candidates || [], chosen: r.suggested, confirmed: false, paste: "" })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setBusy(false);
    }
  };

  const patch = (i: number, p: Partial<Row>) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  const applyPasted = (i: number) => {
    const asin = extractAsin(rows[i].paste);
    if (!asin) return patch(i, { paste: "" });
    const cand: Candidate = { title: "Pasted by you", asin, url: `https://www.amazon.com/dp/${asin}` };
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, candidates: [cand, ...r.candidates], chosen: 0, paste: "" } : r)));
  };

  const confirmed = rows.filter((r) => r.confirmed && r.chosen !== null);
  const send = () => {
    onAsins(confirmed.map((r) => r.candidates[r.chosen as number].asin));
    setRows([]);
    setScript("");
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/40 p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Find products from the script</p>
      <textarea className="input-field text-sm resize-y" rows={4} value={script} onChange={(e) => setScript(e.target.value)} placeholder="Paste the full video script here…" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-faint)]">Searches this channel&apos;s product website. You confirm each product before it is added below.</p>
        <button type="button" className="btn-primary text-sm !py-2 flex items-center gap-2 flex-shrink-0" disabled={busy || script.trim().length < 20 || !channelId} onClick={search}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {busy ? "Searching…" : "Search"}
        </button>
      </div>
      {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}

      {rows.map((r, i) => (
        <div key={i} className={cn("rounded-lg border p-3 space-y-2", r.confirmed ? "border-[var(--color-green)]/40 bg-[var(--color-green-soft)]" : "border-[var(--border)] bg-[var(--surface)]")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--text)]">
              {i + 1}. {r.name}
            </p>
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", BADGE[r.status]?.[1])}>{BADGE[r.status]?.[0] ?? r.status}</span>
          </div>
          {r.reason && <p className="text-xs text-[var(--text-muted)]">{r.reason}</p>}

          {r.candidates.map((c, ci) => (
            <label key={c.asin + ci} className={cn("flex items-start gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer", r.chosen === ci ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)]" : "border-[var(--border)]")}>
              <input type="radio" className="mt-1" name={`ps-${i}`} checked={r.chosen === ci} onChange={() => patch(i, { chosen: ci, confirmed: false })} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-[var(--text)] break-words">{c.title}</span>
                <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-xs font-mono text-[var(--color-purple)] hover:underline inline-flex items-center gap-1 break-all">
                  {c.url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              </span>
            </label>
          ))}

          {!r.confirmed && (
            <div className="flex gap-2">
              <input
                className="input-field text-xs !py-1.5 flex-1 font-mono"
                value={r.paste}
                onChange={(e) => patch(i, { paste: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && applyPasted(i)}
                placeholder="Not right? Paste the Amazon link / ASIN"
              />
              <button type="button" className="btn-secondary text-xs !py-1.5 px-3" disabled={!r.paste.trim()} onClick={() => applyPasted(i)}>
                Use
              </button>
            </div>
          )}

          <div className="flex justify-end">
            {r.confirmed ? (
              <button type="button" className="text-xs text-[var(--color-purple)] hover:underline flex items-center gap-1" onClick={() => patch(i, { confirmed: false })}>
                <Check className="w-3.5 h-3.5 text-[var(--color-green)]" /> Confirmed - change
              </button>
            ) : (
              <button type="button" className="btn-primary text-xs !py-1.5 px-4 disabled:opacity-50" disabled={r.chosen === null} onClick={() => patch(i, { confirmed: true })}>
                Confirm
              </button>
            )}
          </div>
        </div>
      ))}

      {rows.length > 0 && (
        <div className="flex justify-end">
          <button type="button" className="btn-primary text-sm !py-2 disabled:opacity-50" disabled={confirmed.length === 0} onClick={send}>
            Add {confirmed.length} confirmed to Affiliate products
          </button>
        </div>
      )}
    </div>
  );
}
