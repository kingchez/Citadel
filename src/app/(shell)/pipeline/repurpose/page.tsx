"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Film, Loader2, Repeat, RotateCcw, Tag } from "lucide-react";
import { RepurposeStatusBadge } from "@/components/repurpose-status-badge";
import { cn, formatTimeAgo } from "@/lib/utils";
import { formatSeconds } from "@/lib/repurpose-utils";
import { REPURPOSE_ERROR_STATUSES, type RepurposeRow } from "@/lib/repurpose-types";

const ROW_CLASS =
  "group flex items-center gap-4 px-5 py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] transition-all duration-150";

function RepurposeRowItem({ item, onRetried }: { item: RepurposeRow; onRetried: () => void }) {
  const isError = REPURPOSE_ERROR_STATUSES.includes(item.status);
  const hasError = isError && !!item.error_details;
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const retry = async (e: React.MouseEvent) => {
    // The whole row is a link to the video - don't navigate when pressing Retry.
    e.preventDefault();
    e.stopPropagation();
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/repurpose/${item.id}/retry`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setRetryError(data.error || "Retry failed.");
      else onRetried();
    } catch {
      setRetryError("Network error.");
    } finally {
      setRetrying(false);
    }
  };

  const content = (
    <>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-[var(--text)] truncate">{item.title}</h3>
        <p className="text-xs text-[var(--text-faint)] mt-0.5 flex items-center gap-1.5 flex-wrap">
          <span>{item.channel}</span>
          <span>·</span>
          <span>
            {item.intro_mode === "replace" && item.new_intro_start_seconds !== null
              ? `New intro from ${formatSeconds(Number(item.new_intro_start_seconds))}`
              : "Original intro"}
          </span>
          {item.video?.with_product && (
            <>
              <span>·</span>
              <span className="text-[var(--color-purple)]">
                <Tag className="w-3 h-3 inline mr-0.5" />
                {(item.video.product_ids ?? []).length} product{(item.video.product_ids ?? []).length === 1 ? "" : "s"}
              </span>
            </>
          )}
          <span>·</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
            {item.video_id ?? item.id}
          </span>
        </p>
        {hasError && (
          <p className="text-xs text-[var(--color-red)] mt-1 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span className="break-words">{item.error_details}</span>
          </p>
        )}
        {retryError && <p className="text-xs text-[var(--color-red)] mt-1">{retryError}</p>}
      </div>

      <div className="flex-shrink-0">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">
          <Film className="w-3.5 h-3.5" />
          {item.video_type === "vertical-shorts" ? "Vertical" : "Horizontal"}
        </span>
      </div>

      <div className="flex-shrink-0 flex items-center gap-2">
        {isError && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--color-red)]/40 text-xs font-medium text-[var(--color-red)] hover:bg-[var(--color-red-soft)] disabled:opacity-50"
          >
            {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Retry
          </button>
        )}
        <RepurposeStatusBadge status={item.status} />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(item.updated_at)}</span>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-[var(--border-strong)] transition-colors",
            item.video_id && "group-hover:text-[var(--color-purple)]"
          )}
        />
      </div>
    </>
  );

  // The whole row opens the linked video, same as the All Videos list.
  return item.video_id ? (
    <Link
      href={`/pipeline/videos/${item.video_id}`}
      className={cn(ROW_CLASS, "hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]")}
    >
      {content}
    </Link>
  ) : (
    <div className={ROW_CLASS}>{content}</div>
  );
}

export default function RepurposeQueuePage() {
  const [items, setItems] = useState<RepurposeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    fetch("/api/repurpose")
      .then((r) => r.json())
      .then((data: { items?: RepurposeRow[]; error?: string }) => {
        setError(data.error ?? null);
        setItems(data.items || []);
      })
      .catch(() => setError("Couldn't load the repurpose queue."))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
    // Keep statuses fresh so a finished download clears its red signal on its own.
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Repurpose Queue</h1>
          <p className="text-sm text-[var(--text-faint)] mt-1">
            Existing videos being split, timed and handed to the main pipeline.
          </p>
        </div>
        <Link href="/pipeline/new" className="btn-primary text-sm">
          Add Video
        </Link>
      </div>

      {error && <p className="text-sm text-[var(--color-red)]">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-[68px] rounded-xl bg-[var(--surface)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center text-sm text-[var(--text-faint)]">
          <Repeat className="w-6 h-6 mx-auto mb-2 text-[var(--border-strong)]" />
          Nothing queued yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <RepurposeRowItem key={item.id} item={item} onRetried={load} />
          ))}
        </div>
      )}
    </div>
  );
}
