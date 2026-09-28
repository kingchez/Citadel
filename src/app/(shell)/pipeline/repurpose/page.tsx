"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Film, Repeat, Tag } from "lucide-react";
import { RepurposeStatusBadge } from "@/components/repurpose-status-badge";
import { formatTimeAgo } from "@/lib/utils";
import { formatSeconds } from "@/lib/repurpose-utils";
import { REPURPOSE_ERROR_STATUSES, type RepurposeRow } from "@/lib/repurpose-types";

export default function RepurposeQueuePage() {
  const [items, setItems] = useState<RepurposeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/repurpose")
      .then((r) => r.json())
      .then((data: { items?: RepurposeRow[]; error?: string }) => {
        if (data.error) setError(data.error);
        setItems(data.items || []);
      })
      .catch(() => setError("Couldn't load the repurpose queue."))
      .finally(() => setLoading(false));
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
        <p className="text-sm text-[var(--text-faint)]">Loading…</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center text-sm text-[var(--text-faint)]">
          <Repeat className="w-6 h-6 mx-auto mb-2 text-[var(--border-strong)]" />
          Nothing queued yet.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl bg-[var(--surface)] border border-[var(--border)] px-5 py-4 space-y-2"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-sm font-semibold text-[var(--text)] truncate flex-1 min-w-0">{item.title}</h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] text-xs font-medium text-[var(--text-muted)]">
                  <Film className="w-3.5 h-3.5" />
                  {item.video_type === "vertical-shorts" ? "Vertical" : "Horizontal"}
                </span>
                <RepurposeStatusBadge status={item.status} />
                <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(item.updated_at)}</span>
              </div>

              <p className="text-xs text-[var(--text-faint)] flex items-center gap-1.5 flex-wrap">
                <span>{item.channel}</span>
                <span>·</span>
                <span>
                  {item.intro_mode === "replace" && item.new_intro_start_seconds !== null
                    ? `New intro from ${formatSeconds(Number(item.new_intro_start_seconds))}`
                    : "Original intro"}
                </span>
                {item.with_product && (
                  <>
                    <span>·</span>
                    <span className="text-[var(--color-purple)]">
                      <Tag className="w-3 h-3 inline mr-0.5" />
                      {item.product_ids.length} product{item.product_ids.length === 1 ? "" : "s"}
                    </span>
                  </>
                )}
                {item.video_id && (
                  <>
                    <span>·</span>
                    <Link href={`/pipeline/videos/${item.video_id}`} className="text-[var(--color-purple)] hover:underline">
                      Open video
                    </Link>
                  </>
                )}
                <span>·</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
                  {item.id}
                </span>
              </p>

              {REPURPOSE_ERROR_STATUSES.includes(item.status) && item.error_details && (
                <p className="text-xs text-[var(--color-red)] flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="break-words">{item.error_details}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
