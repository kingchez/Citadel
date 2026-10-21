"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Loader2, PackageCheck } from "lucide-react";
import { ProductEditor } from "@/components/products-review";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ProductEntry } from "@/lib/types";

interface ReviewItem {
  id: string;
  title: string;
  status: string;
  products_step: "extracting" | "review" | "confirmed" | null;
  source_count: number;
  updated_at: string;
  shop_status: string | null;
  products: ProductEntry[];
}

const CARD = "rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden";

function groupOf(i: ReviewItem): "review" | "working" | "done" {
  if (i.products_step !== "confirmed") return "review";
  const clipsOpen = i.products.some((p) => p.clip === "pending" || p.clip === "error");
  const shopOpen = i.shop_status === "awaiting_clips" || i.shop_status === "pending" || i.shop_status === "processed";
  return clipsOpen || shopOpen ? "working" : "done";
}

function Summary({ i }: { i: ReviewItem }) {
  const count = (c: string) => i.products.filter((p) => p.clip === c).length;
  const parts = [`${i.products.length} product${i.products.length === 1 ? "" : "s"}`];
  if (count("pending")) parts.push(`${count("pending")} clip${count("pending") === 1 ? "" : "s"} waiting`);
  if (count("error")) parts.push(`${count("error")} failed`);
  if (count("done")) parts.push(`${count("done")} cut`);
  if (count("exists")) parts.push(`${count("exists")} already in shop`);
  return <span>{parts.join(" · ")}</span>;
}

export default function ProductsPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/products-review", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load.");
      setItems(data.items as ReviewItem[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
    const t = setInterval(() => void load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  const sections: { key: "review" | "working" | "done"; title: string; hint: string }[] = [
    { key: "review", title: "Needs your review", hint: "Pick each product, check its start and end, then confirm." },
    { key: "working", title: "Clips & shop in progress", hint: "Confirmed. Clips are being cut and the products sent to the shop." },
    { key: "done", title: "Done", hint: "" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2"><PackageCheck className="w-5 h-5" /> Products</h1>
        <p className="text-xs text-[var(--text-faint)] mt-1">Products for repurposed videos: find them in the voice timing, confirm the ASIN and where each one starts and ends. Each new product gets its own video clip.</p>
      </div>

      {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
      {!items && !error && <p className="text-xs text-[var(--text-faint)] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>}

      {items &&
        sections.map((sec) => {
          const list = items.filter((i) => groupOf(i) === sec.key);
          return (
            <section key={sec.key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-semibold text-[var(--text)]">{sec.title}</h2>
                <span className="text-xs text-[var(--text-faint)]">{list.length}</span>
                {sec.hint && <span className="text-xs text-[var(--text-faint)] hidden sm:inline">- {sec.hint}</span>}
              </div>
              {list.length === 0 && <p className="text-xs text-[var(--text-faint)]">Nothing here.</p>}
              {list.map((i) => (
                <div key={i.id} className={CARD}>
                  <button type="button" onClick={() => setOpen(open === i.id ? null : i.id)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3.5 text-left hover:bg-[var(--surface-raised)]/50">
                    <ChevronRight className={cn("w-4 h-4 text-[var(--text-faint)] transition-transform", open === i.id && "rotate-90")} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text)] truncate">{i.title}</h3>
                      <p className="text-xs text-[var(--text-faint)] mt-0.5">
                        {i.products_step === "extracting" ? "Reading the transcript…" : <Summary i={i} />} · {i.source_count} video{i.source_count === 1 ? "" : "s"} · {formatTimeAgo(i.updated_at)}
                      </p>
                    </div>
                  </button>
                  {open === i.id && <ProductEditor id={i.id} onChanged={() => void load()} />}
                </div>
              ))}
            </section>
          );
        })}
    </div>
  );
}
