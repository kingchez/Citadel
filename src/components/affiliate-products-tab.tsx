"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, ExternalLink, X, Pencil, Check, Loader2, PackagePlus, Trash2, Link2 } from "lucide-react";
import type { ProductEntry } from "@/lib/types";
import { buildAmazonProductUrl } from "@/lib/amazon";
import { formatTimeAgo } from "@/lib/utils";

interface AffiliateProductsTabProps {
  videoId: string;
  products: ProductEntry[];
  productOutputUrl?: string;
  onUpdated: () => void;
}

export function AffiliateProductsTab({ videoId, products, productOutputUrl, onUpdated }: AffiliateProductsTabProps) {
  const [rawInput, setRawInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ added: number; skippedDuplicates: number; failed: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [outputUrlDraft, setOutputUrlDraft] = useState(productOutputUrl || "");
  const [savingOutputUrl, setSavingOutputUrl] = useState(false);
  const [outputUrlJustSaved, setOutputUrlJustSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local draft when the saved value changes externally (e.g. after a reload)
    setOutputUrlDraft(productOutputUrl || "");
  }, [productOutputUrl]);

  const handleAdd = async () => {
    if (!rawInput.trim()) return;
    setAdding(true);
    setError(null);
    setAddResult(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/products/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_input: rawInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add products.");
      setAddResult({ added: data.added, skippedDuplicates: data.skippedDuplicates, failed: data.failed || [] });
      setRawInput("");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add products.");
    } finally {
      setAdding(false);
    }
  };

  const replaceList = async (next: ProductEntry[], outputUrl?: string): Promise<boolean> => {
    setSavingList(true);
    try {
      const payload: { products: ProductEntry[]; product_output_url?: string } = { products: next };
      if (outputUrl !== undefined) payload.product_output_url = outputUrl;
      const res = await fetch(`/api/videos/${videoId}/products`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not update products.");
      onUpdated();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update products.");
      return false;
    } finally {
      setSavingList(false);
    }
  };

  const handleSaveOutputUrl = async () => {
    setSavingOutputUrl(true);
    try {
      const success = await replaceList(products, outputUrlDraft);
      if (success) {
        setOutputUrlJustSaved(true);
        setTimeout(() => setOutputUrlJustSaved(false), 2000);
      }
    } finally {
      setSavingOutputUrl(false);
    }
  };

  const handleRemove = (index: number) => {
    replaceList(products.filter((p) => p.index !== index));
  };

  const handleClearAll = () => {
    replaceList([]);
    setConfirmClearAll(false);
  };

  const startEdit = (p: ProductEntry) => {
    setEditingIndex(p.index);
    setEditDraft(p.asin);
  };

  const saveEdit = (p: ProductEntry) => {
    const next = products.map((x) => (x.index === p.index ? { ...x, asin: editDraft.trim().toUpperCase() } : x));
    replaceList(next);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <PackagePlus className="w-5 h-5 text-[var(--color-purple)]" />
          <h3 className="font-semibold text-[var(--text)]">Add Products</h3>
        </div>
        <p className="text-xs text-[var(--text-faint)]">
          Paste one or more Amazon product URLs, separated by commas or new lines — or just the ASINs directly. The ASIN
          gets extracted and stored automatically.
        </p>
        <textarea
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={"https://www.amazon.com/dp/B0BXYZ1234\nhttps://www.amazon.com/gp/product/B0CABC5678"}
          rows={4}
          className="input-field text-sm resize-none font-mono"
        />
        {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}
        {addResult && (
          <div className="text-xs text-[var(--text-muted)] space-y-1">
            <p className="text-[var(--color-green)]">
              Added {addResult.added} product{addResult.added !== 1 ? "s" : ""}
              {addResult.skippedDuplicates > 0 && ` (${addResult.skippedDuplicates} already on this video)`}.
            </p>
            {addResult.failed.length > 0 && (
              <p className="text-[var(--color-amber)]">
                Couldn&apos;t read an ASIN from: {addResult.failed.join(", ")}
              </p>
            )}
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!rawInput.trim() || adding}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
          >
            {adding && <Loader2 className="w-4 h-4 animate-spin" />}
            Add Products
          </button>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-[var(--color-purple)]" />
          <h3 className="font-semibold text-[var(--text)]">Product Output URL</h3>
        </div>
        <p className="text-xs text-[var(--text-faint)]">
          Optional — a single link for this video&apos;s affiliate output (e.g. a storefront page or aggregated link),
          separate from the individual product ASINs above.
        </p>
        <div className="flex items-center gap-2">
          <input
            value={outputUrlDraft}
            onChange={(e) => setOutputUrlDraft(e.target.value)}
            placeholder="https://..."
            className="input-field text-sm py-2 font-mono flex-1"
          />
          <button
            onClick={handleSaveOutputUrl}
            disabled={savingOutputUrl || outputUrlDraft === (productOutputUrl || "")}
            className={`text-sm py-2 px-4 flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0 transition-colors ${
              outputUrlJustSaved
                ? "bg-[var(--color-green)] text-white rounded-xl font-medium"
                : "btn-secondary"
            }`}
          >
            {savingOutputUrl ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : outputUrlJustSaved ? (
              <Check className="w-4 h-4" />
            ) : null}
            {savingOutputUrl ? "Saving..." : outputUrlJustSaved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)]/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[var(--color-purple)]" />
            <h3 className="font-semibold text-[var(--text)]">
              {products.length} Product{products.length !== 1 ? "s" : ""}
            </h3>
          </div>
          {products.length > 0 &&
            (confirmClearAll ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-faint)]">Remove all products?</span>
                <button onClick={handleClearAll} disabled={savingList} className="btn-danger text-xs py-1.5 px-3">
                  Yes, clear all
                </button>
                <button onClick={() => setConfirmClearAll(false)} className="btn-secondary text-xs py-1.5 px-3">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClearAll(true)}
                className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--color-red)] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove all
              </button>
            ))}
        </div>

        {products.length === 0 ? (
          <div className="p-10 text-center">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-[var(--border-strong)]" />
            <p className="text-sm text-[var(--text-faint)]">
              No products yet — this video won&apos;t show the Affiliate tag until you add one.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {products.map((p) => (
              <div key={p.index} className="flex items-center gap-3 px-5 py-3">
                {editingIndex === p.index ? (
                  <>
                    <input
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="input-field text-sm py-1.5 font-mono flex-1"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(p)} className="btn-ghost p-1.5" aria-label="Save">
                      <Check className="w-4 h-4 text-[var(--color-green)]" />
                    </button>
                    <button onClick={() => setEditingIndex(null)} className="btn-ghost p-1.5" aria-label="Cancel">
                      <X className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <a
                        href={buildAmazonProductUrl(p.asin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-mono font-semibold text-[var(--text)] hover:text-[var(--color-purple)] inline-flex items-center gap-1.5"
                      >
                        {p.asin}
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-faint)]" />
                      </a>
                      <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Added {formatTimeAgo(p.added_at)}</p>
                    </div>
                    <button onClick={() => startEdit(p)} className="btn-ghost p-1.5" aria-label={`Edit ${p.asin}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRemove(p.index)}
                      disabled={savingList}
                      className="btn-ghost p-1.5 hover:text-[var(--color-red)]"
                      aria-label={`Remove ${p.asin}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
