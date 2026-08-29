"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import type { ScriptSegment, VideoRow } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { SegmentRow, AudioPlayerBar } from "@/components/segment-row";
import { VideoOutputModal } from "@/components/video-output-modal";
import { MediaAssetCard } from "@/components/media-asset-card";
import { ScriptEditor } from "@/components/script-editor";
import { formatTimeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Tag,
  Film,
  PlayCircle,
  CheckSquare,
  Square,
  RotateCcw,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Clock,
  Layers,
  MessageSquareWarning,
  Image as ImageIcon,
} from "lucide-react";

interface VideoDetailProps {
  params: Promise<{ id: string }>;
}

const APPROVABLE_STATUSES = new Set(["media_review", "production_review", "done"]);

export default function VideoDetailPage({ params }: VideoDetailProps) {
  const { id } = use(params);
  const [video, setVideo] = useState<VideoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showOutputModal, setShowOutputModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"segments" | "media">("segments");
  const [audioBlobUrls, setAudioBlobUrls] = useState<Record<string, string>>({});

  const loadVideo = () => {
    fetch(`/api/videos/${id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data: { video?: VideoRow } | null) => {
        if (data?.video) setVideo(data.video);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVideo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Prefetch every segment's audio as soon as the video (and its file ids)
  // are known, so clicking play is instant instead of downloading on
  // demand. Blob URLs are revoked whenever the file id set changes and on
  // unmount (navigating away), so nothing lingers in memory.
  useEffect(() => {
    const fileIds = Array.from(
      new Set((video?.script_segments || []).map((s) => s.voiceover_drive_file_id).filter((v): v is string => !!v))
    );
    if (fileIds.length === 0) return;

    let cancelled = false;
    const objectUrls: string[] = [];

    (async () => {
      const entries = await Promise.all(
        fileIds.map(async (fileId) => {
          try {
            const res = await fetch(`/api/drive/${fileId}`);
            if (!res.ok) return null;
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            objectUrls.push(url);
            return [fileId, url] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) {
        objectUrls.forEach((u) => URL.revokeObjectURL(u));
        return;
      }
      const map: Record<string, string> = {};
      for (const entry of entries) {
        if (entry) map[entry[0]] = entry[1];
      }
      setAudioBlobUrls(map);
    })();

    return () => {
      cancelled = true;
      objectUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // Re-run only when the actual set of file ids changes, not on every
    // video refetch (redo/retry swaps ids in place, which this still
    // catches since the join below changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(video?.script_segments || []).map((s) => s.voiceover_drive_file_id).join(",")]);

  const showFeedback = (msg: string, ms = 3500) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), ms);
  };

  if (loading) {
    return <div className="p-6 max-w-5xl mx-auto text-[var(--text-faint)]">Loading...</div>;
  }

  if (notFound || !video) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-[var(--text-muted)]">Video not found.</p>
        <Link href="/pipeline/videos" className="text-[var(--color-purple)] hover:opacity-80 text-sm mt-2 inline-block">
          Back to Pipeline
        </Link>
      </div>
    );
  }

  const segments: ScriptSegment[] = video.script_segments || [];
  const mediaEntries = Object.entries(video.media_assets || {});
  const revisionHistory = video.revision_history || [];
  const pendingRevisions = revisionHistory.filter((r) => r.status === "pending");
  const allSelected = segments.length > 0 && selectedIndices.size === segments.length;
  const someSelected = selectedIndices.size > 0 && !allSelected;
  const playingSegment = segments.find((s) => s.index === playingIndex);
  const errorCount = segments.filter((s) => !!s.error).length;
  const successCount = segments.filter((s) => !s.error && !!s.voiceover_drive_file_id).length;

  const handleSelectAll = () => {
    setSelectedIndices(allSelected ? new Set() : new Set(segments.map((s) => s.index)));
  };

  const handleSelectOne = (index: number, checked: boolean) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (checked) next.add(index);
      else next.delete(index);
      return next;
    });
  };

  const handleRetryOne = async (index: number) => {
    try {
      const res = await fetch("/api/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: video.id, service: "chatterbox", target: { segment_index: index } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Retry failed");
      showFeedback(`Segment ${index + 1} queued for retry`);
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Retry failed");
    }
  };

  const handleRedoSelected = async (all: boolean) => {
    setActionLoading(true);
    try {
      const indices = all ? [] : Array.from(selectedIndices);
      const res = await fetch(`/api/videos/${video.id}/redo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment_indices: indices }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not queue redo");
      showFeedback(
        all ? "All segments queued for redo — bypassing the retries table" : `${indices.length} segment(s) queued for redo`,
        4000
      );
      setSelectedIndices(new Set());
      loadVideo();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not queue redo");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_status: video.status }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Approve failed");
      showFeedback("Approved — moved to the next stage");
      loadVideo();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveRevision = async (entryId: string) => {
    try {
      const res = await fetch(`/api/videos/${video.id}/revision/${entryId}/resolve`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || "Could not resolve");
      showFeedback("Marked resolved");
      loadVideo();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Could not resolve");
    }
  };

  const handlePlay = (index: number) => setPlayingIndex((prev) => (prev === index ? null : index));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link href="/pipeline/videos" className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Back to Pipeline
      </Link>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--text)] leading-tight">{video.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-sm text-[var(--text-muted)]">{video.channel}</span>
              <span className="text-[var(--border-strong)]">·</span>
              <span className="inline-flex items-center gap-1 text-sm text-[var(--text-muted)]">
                <Film className="w-4 h-4" />
                {video.video_type === "vertical-shorts" ? "Vertical" : "Horizontal"}
              </span>
              {video.with_product && (
                <>
                  <span className="text-[var(--border-strong)]">·</span>
                  <span className="inline-flex items-center gap-1 text-sm text-[var(--color-purple)]">
                    <Tag className="w-4 h-4" />
                    Affiliate
                  </span>
                </>
              )}
              <span className="text-[var(--border-strong)]">·</span>
              <span className="text-xs text-[var(--text-faint)]">Updated {formatTimeAgo(video.updated_at)}</span>
              <span className="text-[var(--border-strong)]">·</span>
              <button
                onClick={() => navigator.clipboard?.writeText(video.id)}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
                title="Click to copy database ID"
              >
                {video.id}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <StatusBadge status={video.status} size="md" />
            {video.output_drive_link && (
              <button
                onClick={() => setShowOutputModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--color-green-soft)] text-[var(--color-green)] border border-[var(--color-green)]/30 hover:bg-[var(--color-green)] hover:text-white hover:border-[var(--color-green)] transition-all duration-200 text-sm font-semibold"
              >
                <PlayCircle className="w-4 h-4" />
                View Output
              </button>
            )}
            {APPROVABLE_STATUSES.has(video.status) && (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-green)] text-white hover:opacity-90 transition-opacity text-sm font-semibold disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
            )}
          </div>
        </div>

        {video.status === "render_error" && video.error_details && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/40">
            <AlertTriangle className="w-5 h-5 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-red)]">Render Error</p>
              <p className="text-sm text-[var(--color-red)] mt-1 font-mono opacity-90">{video.error_details}</p>
            </div>
          </div>
        )}

        {segments.length > 0 && (
          <div className="flex items-center gap-4 pt-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[var(--text-faint)]" />
              <span className="text-sm text-[var(--text-faint)]">{segments.length} segments</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />
              <span className="text-sm text-[var(--color-green)]">{successCount} done</span>
            </div>
            {errorCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--color-red)]" />
                <span className="text-sm text-[var(--color-red)]">{errorCount} failed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {revisionHistory.length > 0 && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquareWarning className="w-5 h-5 text-[var(--color-amber)]" />
            <h2 className="font-semibold text-[var(--text)]">Revision History</h2>
            {pendingRevisions.length > 0 && <span className="badge badge-amber">{pendingRevisions.length} pending</span>}
          </div>

          <div className="space-y-2">
            {revisionHistory
              .slice()
              .reverse()
              .map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    entry.status === "pending"
                      ? "bg-[var(--color-amber-soft)]/40 border-[var(--color-amber)]/30"
                      : "bg-[var(--surface-raised)] border-[var(--border)]"
                  }`}
                >
                  {entry.status === "resolved" ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--color-green)] flex-shrink-0 mt-0.5" />
                  ) : (
                    <Clock className="w-5 h-5 text-[var(--color-amber)] flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text)]">{entry.note}</p>
                    <p className="text-[11px] text-[var(--text-faint)] mt-1">
                      {formatTimeAgo(entry.created_at)}
                      {entry.status === "resolved" && entry.resolved_at && ` · resolved ${formatTimeAgo(entry.resolved_at)}`}
                    </p>
                  </div>
                  {entry.status === "pending" && (
                    <button
                      onClick={() => handleResolveRevision(entry.id)}
                      className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0"
                      title="Manual override until the fixing agent exists"
                    >
                      Mark resolved
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)]/60 shadow-2xl animate-slide-down">
          <RefreshCw className="w-4 h-4 text-[var(--color-purple)]" />
          <span className="text-sm font-medium text-[var(--text)]">{feedback}</span>
        </div>
      )}

      {(segments.length > 0 || mediaEntries.length > 0) && (
        <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit">
          <button onClick={() => setActiveTab("segments")} className={`tab flex items-center gap-2 ${activeTab === "segments" ? "tab-active" : ""}`}>
            <Layers className="w-4 h-4" />
            Voiceover Segments
            {segments.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "segments" ? "bg-white/20 text-white" : "bg-[var(--border)] text-[var(--text-faint)]"}`}>
                {segments.length}
              </span>
            )}
          </button>
          <button onClick={() => setActiveTab("media")} className={`tab flex items-center gap-2 ${activeTab === "media" ? "tab-active" : ""}`}>
            <ImageIcon className="w-4 h-4" />
            Media Assets
            {mediaEntries.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === "media" ? "bg-white/20 text-white" : "bg-[var(--border)] text-[var(--text-faint)]"}`}>
                {mediaEntries.length}
              </span>
            )}
          </button>
        </div>
      )}

      {activeTab === "segments" && segments.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)]/50 flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                aria-label={allSelected ? "Deselect all segments" : "Select all segments"}
              >
                {allSelected ? (
                  <CheckSquare className="w-5 h-5 text-[var(--color-purple)]" />
                ) : someSelected ? (
                  <div className="w-5 h-5 rounded border-2 border-[var(--color-purple)] bg-[var(--color-purple)]/30 flex items-center justify-center">
                    <span className="w-2 h-0.5 bg-[var(--color-purple)]" />
                  </div>
                ) : (
                  <Square className="w-5 h-5" />
                )}
                <span className="font-medium">{selectedIndices.size > 0 ? `${selectedIndices.size} selected` : "Select all"}</span>
              </button>
            </div>

            {selectedIndices.size > 0 && (
              <div className="flex items-center gap-2">
                {!allSelected && (
                  <button
                    onClick={() => handleRedoSelected(false)}
                    disabled={actionLoading}
                    className="btn-amber flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Redo {selectedIndices.size} segment{selectedIndices.size > 1 ? "s" : ""}
                  </button>
                )}
                {allSelected && (
                  <button
                    onClick={() => handleRedoSelected(true)}
                    disabled={actionLoading}
                    className="btn-danger flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Redo all segments
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="p-4 space-y-2">
            {segments.map((seg) => (
              <SegmentRow
                key={seg.index}
                segment={seg}
                selected={selectedIndices.has(seg.index)}
                onSelect={handleSelectOne}
                onRetry={handleRetryOne}
                onPlay={handlePlay}
                isPlaying={playingIndex === seg.index}
              />
            ))}
          </div>

          {playingSegment?.voiceover_drive_file_id && (
            <div className="px-4 pb-4">
              <AudioPlayerBar
                segmentIndex={playingSegment.index}
                segmentText={playingSegment.text || ""}
                fileId={playingSegment.voiceover_drive_file_id}
                src={audioBlobUrls[playingSegment.voiceover_drive_file_id]}
                onClose={() => setPlayingIndex(null)}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "media" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mediaEntries.length === 0 ? (
            <div className="col-span-full card p-10 text-center">
              <ImageIcon className="w-12 h-12 mx-auto mb-3 text-[var(--border-strong)]" />
              <p className="text-[var(--text-muted)] font-medium">No media assets yet</p>
              <p className="text-sm text-[var(--text-faint)] mt-1">These populate once the pipeline starts sourcing media.</p>
            </div>
          ) : (
            mediaEntries
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([key, asset]) => (
                <MediaAssetCard key={key} videoId={video.id} mediaKey={key} asset={asset} onUpdated={loadVideo} />
              ))
          )}
        </div>
      )}

      {segments.length === 0 && mediaEntries.length === 0 && (
        <div className="card p-10 text-center">
          <Clock className="w-12 h-12 mx-auto mb-3 text-[var(--border-strong)]" />
          <p className="text-[var(--text-muted)] font-medium">Nothing here yet</p>
          <p className="text-sm text-[var(--text-faint)] mt-1">Segments and media will appear once the pipeline starts processing this video.</p>
        </div>
      )}

      {segments.length > 0 && (
        <details className="card group">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none hover:bg-[var(--surface-raised)] transition-colors rounded-xl">
            <span className="font-semibold text-[var(--text)]">Full Script</span>
            <span className="text-sm text-[var(--text-faint)] group-open:hidden">Click to expand</span>
            <span className="text-sm text-[var(--text-faint)] hidden group-open:inline">Click to collapse</span>
          </summary>
          <div className="px-5 pb-5 pt-2 border-t border-[var(--border)]">
            <ScriptEditor videoId={video.id} segments={segments} onUpdated={loadVideo} />
          </div>
        </details>
      )}

      {showOutputModal && video.output_drive_link && (
        <VideoOutputModal
          videoId={video.id}
          title={video.title}
          outputDriveLink={video.output_drive_link}
          revisionHistory={revisionHistory}
          onClose={() => setShowOutputModal(false)}
          onRevisionSubmitted={() => {
            loadVideo();
            setTimeout(() => setShowOutputModal(false), 1500);
          }}
        />
      )}
    </div>
  );
}
