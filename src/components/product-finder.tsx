"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ExternalLink, Globe, Loader2, Search, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildAmazonProductUrl, extractAsin } from "@/lib/amazon";
import type { ExtractedProduct, MatchCandidate, MatchResponse } from "@/lib/product-finder-types";
import { ProductSitesManager, channelLabelOf, type ProductSiteDTO } from "@/components/product-sites-manager";

/** Adds confirmed product links under what is already in an Affiliate products box, skipping ASINs that are already there. */
export function appendProductLines(existing: string, urls: string[]): string {
  const have = new Set(existing.split(/[\n,]+/).map((l) => extractAsin(l)).filter(Boolean));
  const fresh = urls.filter((u) => {
    const asin = extractAsin(u);
    return asin ? !have.has(asin) : true;
  });
  if (fresh.length === 0) return existing;
  const base = existing.trim() ? existing.replace(/\s+$/, "") + "\n" : "";
  return base + fresh.join("\n");
}

interface Item {
  id: number;
  name: string;
  mention: string;
  state: "queued" | "searching" | "done" | "error";
  error?: string;
  result?: MatchResponse;
  candidates: MatchCandidate[];
  selectedKey: string | null;
  confirmed: boolean;
  skipped: boolean;
  searchText: string;
  manualPaste: string;
  manualError?: string;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  exact: { label: "Exact", cls: "bg-[var(--color-green-soft)] text-[var(--color-green)]" },
  likely: { label: "Likely", cls: "bg-[var(--color-cyan-soft)] text-[var(--color-cyan)]" },
  ambiguous: { label: "Pick one", cls: "bg-[var(--color-amber-soft)] text-[var(--color-amber)]" },
  none: { label: "Not found", cls: "bg-[var(--color-red-soft)] text-[var(--color-red)]" },
};

const CONCURRENCY = 3;

export function ProductFinder({ channelId, onConfirm, onClose }: { channelId?: string | null; onConfirm: (urls: string[]) => void; onClose: () => void }) {
  const [sites, setSites] = useState<ProductSiteDTO[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showSites, setShowSites] = useState(false);
  const [script, setScript] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const initialised = useRef(false);

  const loadSites = useCallback(async () => {
    try {
      const res = await fetch("/api/product-sites");
      const data = await res.json();
      const list: ProductSiteDTO[] = data.sites || [];
      setSites(list);
      setSelected((prev) => {
        const enabled = list.filter((s) => s.enabled);
        if (!initialised.current) {
          initialised.current = true;
          // Default: this channel's sites if it has any, otherwise every enabled site.
          const mine = channelId ? enabled.filter((s) => s.source_channel_id === channelId) : [];
          return new Set((mine.length > 0 ? mine : enabled).map((s) => s.id));
        }
        const ids = new Set(enabled.map((s) => s.id));
        return new Set([...prev].filter((id) => ids.has(id)));
      });
    } catch {
      setSites((prev) => prev ?? []);
    }
  }, [channelId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    loadSites();
  }, [loadSites]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ProductSiteDTO[]>();
    for (const s of (sites || []).filter((x) => x.enabled)) {
      const key = channelLabelOf(s) || "Any channel";
      groups.set(key, [...(groups.get(key) || []), s]);
    }
    return [...groups.entries()];
  }, [sites]);

  const patchItem = useCallback((id: number, patch: Partial<Item> | ((i: Item) => Partial<Item>)) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...(typeof patch === "function" ? patch(i) : patch) } : i)));
  }, []);

  /** One search for one product. manual = the typed search box (looser, no AI). */
  const search = useCallback(
    async (id: number, name: string, mention: string, manual = false) => {
      patchItem(id, { state: "searching", error: undefined });
      try {
        const res = await fetch("/api/product-finder/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, mention, manual, site_ids: [...selected] }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed.");
        const result = data as MatchResponse;
        patchItem(id, {
          state: "done",
          result,
          candidates: result.candidates,
          selectedKey: result.suggested,
          confirmed: false,
        });
      } catch (err) {
        patchItem(id, { state: "error", error: err instanceof Error ? err.message : "Search failed." });
      }
    },
    [patchItem, selected]
  );

  const extract = async () => {
    setExtracting(true);
    setExtractError(null);
    try {
      const res = await fetch("/api/product-finder/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ script }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't read the script.");
      const products = data.products as ExtractedProduct[];
      const fresh: Item[] = products.map((p, i) => ({
        id: i,
        name: p.name,
        mention: p.mention,
        state: "queued",
        candidates: [],
        selectedKey: null,
        confirmed: false,
        skipped: false,
        searchText: p.name,
        manualPaste: "",
      }));
      setItems(fresh);
      // Search a few at a time so one slow site doesn't hold up the rest.
      let next = 0;
      const worker = async () => {
        while (next < fresh.length) {
          const item = fresh[next++];
          await search(item.id, item.name, item.mention);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fresh.length) }, worker));
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Couldn't read the script.");
    } finally {
      setExtracting(false);
    }
  };

  const pasteManual = (item: Item) => {
    const asin = extractAsin(item.manualPaste);
    if (!asin) {
      patchItem(item.id, { manualError: "Couldn't read an ASIN from that. Paste a full Amazon link or the 10-character ASIN." });
      return;
    }
    const cand: MatchCandidate = {
      key: `manual-${asin}`,
      title: "Pasted by you",
      site_label: "manual",
      sites: [],
      score: 1,
      href: buildAmazonProductUrl(asin),
      asin,
      amazon_url: buildAmazonProductUrl(asin),
      clean_url: buildAmazonProductUrl(asin),
    };
    patchItem(item.id, (i) => ({ candidates: [cand, ...i.candidates.filter((c) => c.key !== cand.key)], selectedKey: cand.key, manualPaste: "", manualError: undefined, confirmed: false }));
  };

  const selectedCandidate = (i: Item) => i.candidates.find((c) => c.key === i.selectedKey) ?? null;
  const confirmable = (i: Item) => !i.skipped && !!selectedCandidate(i)?.clean_url;
  const confirmedItems = items.filter((i) => i.confirmed && !i.skipped);
  const autoItems = items.filter((i) => i.state === "done" && !i.confirmed && !i.skipped && (i.result?.status === "exact" || i.result?.status === "likely") && confirmable(i));
  const searching = items.some((i) => i.state === "searching" || i.state === "queued");

  const addConfirmed = () => {
    const urls = confirmedItems.map((i) => selectedCandidate(i)?.clean_url).filter((u): u is string => !!u);
    onConfirm(urls);
  };

  return (
    <div className="rounded-2xl border border-[var(--color-purple)]/40 bg-[var(--surface-raised)]/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--text)] flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[var(--color-purple)]" /> Find products from the script
          </h3>
          <p className="text-xs text-[var(--text-faint)] mt-0.5">
            Paste the script, the product names are pulled out and looked up on your product sites. You confirm each Amazon link before it goes in the box.
          </p>
        </div>
        <button type="button" className="btn-ghost p-1.5" onClick={onClose} aria-label="Close product finder">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">Search in</p>
          <button type="button" onClick={() => setShowSites((v) => !v)} className="text-xs font-medium text-[var(--color-purple)] hover:underline">
            {showSites ? "Done" : "Manage sites"}
          </button>
        </div>
        {sites === null ? (
          <p className="text-xs text-[var(--text-faint)] flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </p>
        ) : grouped.length === 0 ? (
          <p className="text-xs text-[var(--color-amber)]">No product sites yet - add one under “Manage sites”.</p>
        ) : (
          <div className="space-y-1.5">
            {grouped.map(([group, list]) => (
              <div key={group} className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--text-faint)] mr-1">{group}</span>
                {list.map((s) => {
                  const on = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (n.has(s.id)) n.delete(s.id);
                          else n.add(s.id);
                          return n;
                        })
                      }
                      className={cn(
                        "px-3 py-1 rounded-full text-xs border flex items-center gap-1.5 transition-colors",
                        on ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)] border-[var(--color-purple)]" : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)]"
                      )}
                    >
                      <Globe className="w-3 h-3" />
                      {s.label}
                      <span className="opacity-60">{s.product_count}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {showSites && (
          <div className="pt-2">
            <ProductSitesManager onChanged={loadSites} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <textarea
          className="input-field text-sm resize-y"
          rows={6}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Paste the full YouTube script here…"
        />
        {extractError && <p className="text-xs text-[var(--color-red)]">{extractError}</p>}
        <div className="flex justify-end">
          <button type="button" className="btn-primary flex items-center gap-2 text-sm !py-2" disabled={extracting || script.trim().length < 20 || selected.size === 0} onClick={extract}>
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {items.length > 0 ? "Start over" : "Find products"}
          </button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[var(--text-muted)]">
              {items.length} product{items.length !== 1 ? "s" : ""} found in the script · {confirmedItems.length} confirmed
              {searching && <Loader2 className="inline w-3.5 h-3.5 ml-2 animate-spin" />}
            </p>
            {autoItems.length > 0 && (
              <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => autoItems.forEach((i) => patchItem(i.id, { confirmed: true }))}>
                Confirm all exact &amp; likely ({autoItems.length})
              </button>
            )}
          </div>

          {items.map((item, idx) => (
            <ItemCard
              key={item.id}
              n={idx + 1}
              item={item}
              onSelect={(key) => patchItem(item.id, { selectedKey: key, confirmed: false })}
              onConfirm={() => patchItem(item.id, { confirmed: true })}
              onUnconfirm={() => patchItem(item.id, { confirmed: false })}
              onSkip={() => patchItem(item.id, { skipped: true, confirmed: false })}
              onUnskip={() => patchItem(item.id, { skipped: false })}
              onSearchText={(v) => patchItem(item.id, { searchText: v })}
              onSearch={() => item.searchText.trim() && search(item.id, item.searchText.trim(), item.mention, true)}
              onRetry={() => search(item.id, item.name, item.mention)}
              onPasteText={(v) => patchItem(item.id, { manualPaste: v, manualError: undefined })}
              onPaste={() => pasteManual(item)}
              confirmable={confirmable(item)}
            />
          ))}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-xs text-[var(--text-faint)]">Only confirmed products are added, in script order. Skipped and unconfirmed ones are left out.</p>
            <button type="button" className="btn-primary text-sm !py-2 disabled:opacity-50" disabled={confirmedItems.length === 0} onClick={addConfirmed}>
              Add {confirmedItems.length} to products
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({
  n,
  item,
  confirmable,
  onSelect,
  onConfirm,
  onUnconfirm,
  onSkip,
  onUnskip,
  onSearchText,
  onSearch,
  onRetry,
  onPasteText,
  onPaste,
}: {
  n: number;
  item: Item;
  confirmable: boolean;
  onSelect: (key: string) => void;
  onConfirm: () => void;
  onUnconfirm: () => void;
  onSkip: () => void;
  onUnskip: () => void;
  onSearchText: (v: string) => void;
  onSearch: () => void;
  onRetry: () => void;
  onPasteText: (v: string) => void;
  onPaste: () => void;
}) {
  const status = item.result ? STATUS_STYLE[item.result.status] : null;
  const chosen = item.candidates.find((c) => c.key === item.selectedKey) ?? null;

  if (item.skipped) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 flex items-center justify-between gap-3 opacity-70">
        <p className="text-sm text-[var(--text-muted)] truncate">
          {n}. {item.name} <span className="text-xs text-[var(--text-faint)]">· skipped</span>
        </p>
        <button type="button" className="text-xs text-[var(--color-purple)] hover:underline flex-shrink-0" onClick={onUnskip}>
          Undo
        </button>
      </div>
    );
  }

  if (item.confirmed && chosen) {
    return (
      <div className="rounded-xl border border-[var(--color-green)]/40 bg-[var(--color-green-soft)] px-4 py-2.5 flex items-center gap-3">
        <Check className="w-4 h-4 text-[var(--color-green)] flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--text)] truncate">
            {n}. {item.name}
          </p>
          <p className="text-xs text-[var(--text-muted)] truncate font-mono">{chosen.asin}</p>
        </div>
        <button type="button" className="text-xs text-[var(--color-purple)] hover:underline flex-shrink-0" onClick={onUnconfirm}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text)]">
            {n}. {item.name}
          </p>
          {item.mention && <p className="text-xs text-[var(--text-faint)] italic truncate">“{item.mention}”</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {item.state === "searching" || item.state === "queued" ? (
            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-faint)]" />
          ) : status ? (
            <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", status.cls)}>{status.label}</span>
          ) : null}
          <button type="button" className="btn-ghost p-1" onClick={onSkip} aria-label={`Skip ${item.name}`} title="Skip this product">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {item.state === "error" && (
        <p className="text-xs text-[var(--color-red)] flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> {item.error}
          <button type="button" className="underline" onClick={onRetry}>
            Retry
          </button>
        </p>
      )}

      {item.result?.warnings.map((w) => (
        <p key={w} className="text-xs text-[var(--color-amber)] break-words">
          {w}
        </p>
      ))}

      {item.result?.ai && (
        <p className="text-xs text-[var(--text-muted)] flex items-start gap-1.5">
          <Sparkles className="w-3.5 h-3.5 mt-px text-[var(--color-purple)] flex-shrink-0" />
          <span>
            {item.result.ai.choice ? `AI picked one (${item.result.ai.confidence} confidence)` : "AI couldn't safely pick one"}
            {item.result.ai.reason ? `: ${item.result.ai.reason}` : ""}
          </span>
        </p>
      )}
      {item.result?.ai_error && <p className="text-xs text-[var(--text-faint)]">{item.result.ai_error}</p>}

      {item.candidates.length > 0 && (
        <ul className="space-y-1.5">
          {item.candidates.map((c) => {
            const on = c.key === item.selectedKey;
            return (
              <li key={c.key}>
                <label
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    on ? "border-[var(--color-purple)] bg-[var(--color-purple-soft)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"
                  )}
                >
                  <input type="radio" className="mt-1" name={`cand-${item.id}`} checked={on} onChange={() => onSelect(c.key)} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm text-[var(--text)] break-words">{c.title}</p>
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {c.sites.length > 0 ? c.sites.join(" + ") : c.site_label} · match {Math.round(c.score * 100)}%
                    </p>
                    {c.clean_url ? (
                      <a
                        href={c.amazon_url || c.clean_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono text-[var(--color-purple)] hover:underline inline-flex items-center gap-1 break-all"
                      >
                        {c.amazon_url || c.clean_url} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                      </a>
                    ) : (
                      <p className="text-xs text-[var(--text-faint)] break-words">
                        {c.resolve_error || "Amazon link not looked up yet."}{" "}
                        <a href={c.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="underline">
                          Open the site&apos;s link
                        </a>
                      </p>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {item.state === "done" && item.candidates.length === 0 && <p className="text-xs text-[var(--text-muted)]">Nothing on the selected sites looks like this. Search with different words, or paste the Amazon link below.</p>}

      {item.state !== "searching" && item.state !== "queued" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="input-field text-xs !py-1.5 flex-1"
              value={item.searchText}
              onChange={(e) => onSearchText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              placeholder="Search the sites with other words…"
            />
            <button type="button" className="btn-secondary text-xs !py-1.5 px-3 flex items-center gap-1.5" onClick={onSearch}>
              <Search className="w-3.5 h-3.5" /> Search
            </button>
          </div>
          <div className="flex gap-2">
            <input
              className="input-field text-xs !py-1.5 flex-1 font-mono"
              value={item.manualPaste}
              onChange={(e) => onPasteText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onPaste()}
              placeholder="…or paste the Amazon link / ASIN yourself"
            />
            <button type="button" className="btn-secondary text-xs !py-1.5 px-3" disabled={!item.manualPaste.trim()} onClick={onPaste}>
              Use
            </button>
          </div>
          {item.manualError && <p className="text-xs text-[var(--color-red)]">{item.manualError}</p>}
        </div>
      )}

      <div className="flex justify-end">
        <button type="button" className="btn-primary text-xs !py-1.5 px-4 disabled:opacity-50" disabled={!confirmable} onClick={onConfirm}>
          Confirm this one
        </button>
      </div>
    </div>
  );
}

/** The button that opens the finder; when products are confirmed they are appended to the box via onConfirm and the panel closes. */
export function ProductFinderToggle({ channelId, onConfirm }: { channelId?: string | null; onConfirm: (urls: string[]) => void }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5">
        <Wand2 className="w-3.5 h-3.5" /> Find from script
      </button>
    );
  }
  return (
    <ProductFinder
      channelId={channelId}
      onClose={() => setOpen(false)}
      onConfirm={(urls) => {
        onConfirm(urls);
        setOpen(false);
      }}
    />
  );
}
