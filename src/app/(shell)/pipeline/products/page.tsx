"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2, PackageCheck } from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ProductEntry } from "@/lib/types";

interface ReviewItem {
  id: string;
  title: string;
  status: string;
  kind: "repurpose" | "clip_job";
  products_step: "extracting" | "review" | "confirmed" | null;
  source_count: number;
  updated_at: string;
  shop_status: string | null;
  products: ProductEntry[];
}

type Tab = "review" | "working" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "Needs review" },
  { key: "working", label: "Clips & shop in progress" },
  { key: "done", label: "Done" },
];

const READY_STATUSES = ["voice_timing_done", "handed_off"];

function groupOf(i: ReviewItem): Tab {
  // A clip job still downloading / splitting / reading the voice is "in progress" until its products can be reviewed.
  if (i.kind === "clip_job" && !READY_STATUSES.includes(i.status)) return "working";
  if (i.products_step !== "confirmed") return "review";
  const clipsOpen = i.products.some((p) => p.clip === "pending" || p.clip === "error");
  const shopOpen = i.shop_status === "awaiting_clips" || i.shop_status === "pending" || i.shop_status === "processed";
  return clipsOpen || shopOpen ? "working" : "done";
}

function summary(i: ReviewItem): string {
  const count = (c: string) => i.products.filter((p) => p.clip === c).length;
  const parts = [`${i.products.length} product${i.products.length === 1 ? "" : "s"}`];
  if (count("pending")) parts.push(`${count("pending")} clip${count("pending") === 1 ? "" : "s"} waiting`);
  if (count("error")) parts.push(`${count("error")} failed`);
  if (count("done")) parts.push(`${count("done")} cut`);
  if (count("exists")) parts.push(`${count("exists")} already in shop`);
  return parts.join(" · ");
}

export default function ProductsPage() {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("review");

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

  const counts: Record<Tab, number> = { review: 0, working: 0, done: 0 };
  (items ?? []).forEach((i) => { counts[groupOf(i)] += 1; });
  const list = (items ?? []).filter((i) => groupOf(i) === tab);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-[var(--text)] flex items-center gap-2"><PackageCheck className="w-5 h-5" /> Product Clips</h1>
        <p className="text-xs text-[var(--text-faint)] mt-1">Product clips for repurposed Viral Shop videos and for videos you started a clip job on. Open one to check each product, its ASIN and where it starts and ends, then confirm. Each new product gets its own video clip.</p>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3.5 py-2 text-sm font-medium -mb-px border-b-2 transition-colors",
              tab === t.key ? "border-[var(--color-purple)] text-[var(--color-purple)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
            )}
          >
            {t.label} <span className="ml-1 text-xs opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}
      {!items && !error && <p className="text-xs text-[var(--text-faint)] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>}
      {items && list.length === 0 && <p className="text-xs text-[var(--text-faint)]">Nothing here.</p>}

      <div className="space-y-2">
        {list.map((i) => (
          <Link key={i.id} href={`/pipeline/products/${i.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-raised)]/60">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[var(--text)] truncate">
                {i.title}
                {i.kind === "clip_job" && <span className="ml-2 px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-medium text-[var(--text-muted)] align-middle">Clip job</span>}
              </h3>
              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                {i.kind === "clip_job" && !READY_STATUSES.includes(i.status) ? "Getting the video ready (download, split, voice timing)…" : i.products_step === "extracting" ? "Reading the transcript…" : summary(i)} · {i.source_count} video{i.source_count === 1 ? "" : "s"} · {formatTimeAgo(i.updated_at)}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-faint)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
