"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, AlertTriangle } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { RetryButton } from "@/components/retry-button";
import { ApproveButton } from "@/components/approve-button";
import type { VideoRow, RetryRow, MediaAssetEntry } from "@/lib/types";

interface DetailResponse {
  video: VideoRow;
  retries: RetryRow[];
  inspections: unknown[];
}

const APPROVE_LABEL: Record<string, string> = {
  media_review: "Approve media → mark ready",
  production_review: "Approve → mark done",
  done: "Mark as shipped",
};

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${params.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load video");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load video");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount
    load();
  }, [load]);

  if (loading) {
    return <div className="px-8 py-10 text-sm text-text-muted">Loading…</div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <BackLink />
        <div className="mt-6 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          {error ?? "Video not found."}
        </div>
      </div>
    );
  }

  const { video, retries } = data;
  const approveLabel = APPROVE_LABEL[video.status];

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <BackLink />

      <div className="mt-6 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-text">{video.title}</h1>
            <StatusBadge status={video.status} />
          </div>
          <p className="mt-1.5 text-sm text-text-muted">
            {video.channel} · {video.video_type === "horizontal-long" ? "Horizontal" : "Vertical"}
            {video.with_product ? " · Has affiliate product" : ""}
          </p>
        </div>
        {approveLabel && (
          <ApproveButton
            videoId={video.id}
            currentStatus={video.status}
            label={approveLabel}
            onApproved={load}
          />
        )}
      </div>

      {video.status === "render_error" && video.error_details && (
        <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Render failed</p>
            <p className="mt-0.5 text-danger/80">{video.error_details}</p>
            <div className="mt-2">
              <RetryButton videoId={video.id} service="render" target={null} onQueued={load} />
            </div>
          </div>
        </div>
      )}

      {video.output_drive_link && (
        <a
          href={video.output_drive_link}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
        >
          View finished render <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}

      <Section title="Script segments" count={video.script_segments?.length}>
        {!video.script_segments?.length ? (
          <Empty />
        ) : (
          <div className="divide-y divide-border">
            {video.script_segments.map((seg) => (
              <div key={seg.index} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-faint">Segment {seg.index}</p>
                  <p className="mt-0.5 truncate text-sm text-text">{seg.text}</p>
                  {seg.error && <p className="mt-1 text-xs text-danger">{seg.error}</p>}
                </div>
                {seg.error ? (
                  <RetryButton
                    videoId={video.id}
                    service="chatterbox"
                    target={{ segment_index: seg.index }}
                    onQueued={load}
                  />
                ) : (
                  <span className="shrink-0 text-xs font-medium text-success">✓ Ready</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Voice timing" count={video.voice_timing?.length}>
        {!video.voice_timing?.length ? (
          <Empty />
        ) : (
          <div className="divide-y divide-border">
            {video.voice_timing.map((clip) => (
              <div key={clip.index} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-text-faint">Clip {clip.index}</p>
                  {clip.error && <p className="mt-1 text-xs text-danger">{clip.error}</p>}
                </div>
                {clip.error ? (
                  <RetryButton
                    videoId={video.id}
                    service="whisperx"
                    target={{ clip_index: clip.index }}
                    onQueued={load}
                  />
                ) : (
                  <span className="shrink-0 text-xs font-medium text-success">✓ Aligned</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Media assets" count={Object.keys(video.media_assets ?? {}).length}>
        {!video.media_assets || Object.keys(video.media_assets).length === 0 ? (
          <Empty />
        ) : (
          <div className="divide-y divide-border">
            {Object.entries(video.media_assets).map(([code, asset]) => (
              <MediaAssetRow key={code} code={code} asset={asset} videoId={video.id} onQueued={load} />
            ))}
          </div>
        )}
      </Section>

      {retries.length > 0 && (
        <Section title="Retry history" count={retries.length}>
          <div className="divide-y divide-border">
            {retries.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text">
                    {r.service}
                    {r.target?.segment_index !== undefined && ` · segment ${r.target.segment_index}`}
                    {r.target?.clip_index !== undefined && ` · clip ${r.target.clip_index}`}
                    {r.target?.code && ` · ${r.target.code}`}
                  </p>
                  <p className="mt-0.5 text-xs text-text-faint">
                    Attempt {r.attempt_count} of 3{r.error ? ` — ${r.error}` : ""}
                  </p>
                </div>
                <RetryStatusPill status={r.status} />
              </div>
            ))}
          </div>
        </Section>
      )}

      {video.notes != null && (
        <Section title="Notes">
          <pre className="whitespace-pre-wrap rounded-lg bg-bg p-4 text-xs text-text-muted">
            {typeof video.notes === "string" ? video.notes : JSON.stringify(video.notes, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}

function MediaAssetRow({
  code,
  asset,
  videoId,
  onQueued,
}: {
  code: string;
  asset: MediaAssetEntry;
  videoId: string;
  onQueued: () => void;
}) {
  const status = asset.status ?? (asset.driveFileId ? "provided" : "pending");
  const canRetry = status === "error" || status === "partial";

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{code}</p>
        <p className="mt-0.5 text-xs text-text-faint">{asset.source ?? "manual"}</p>
        {asset.error && <p className="mt-1 text-xs text-danger">{asset.error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <MediaStatusPill status={status} />
        {canRetry && (
          <RetryButton videoId={videoId} service="autobrowse" target={{ code }} onQueued={onQueued} />
        )}
      </div>
    </div>
  );
}

function MediaStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    provided: "bg-success-soft text-success",
    partial: "bg-warning-soft text-warning",
    error: "bg-danger-soft text-danger",
    pending: "bg-bg text-text-muted",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function RetryStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-info-soft text-info",
    dispatched: "bg-warning-soft text-warning",
    done: "bg-success-soft text-success",
    failed: "bg-danger-soft text-danger",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-sm font-semibold text-text">
        {title}
        {typeof count === "number" && <span className="ml-1.5 font-normal text-text-faint">({count})</span>}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Empty() {
  return <p className="text-sm text-text-faint">Nothing here yet.</p>;
}

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> All videos
    </Link>
  );
}
