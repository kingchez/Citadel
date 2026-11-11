"use client";

import { useState, useRef } from "react";
import {
  Image as ImageIcon,
  Camera,
  Sparkles,
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RotateCcw,
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";
import type { MediaAssetEntry } from "@/lib/types";

const sourceIcons: Record<string, React.ElementType> = {
  stock: ImageIcon,
  screen_recording: Camera,
  ai_generated: Sparkles,
  manual: Upload,
};

const sourceLabels: Record<string, string> = {
  stock: "Stock",
  screen_recording: "Screen Recording",
  ai_generated: "AI Generated",
  manual: "Manual Upload",
};

interface MediaAssetCardProps {
  videoId: string;
  mediaKey: string;
  asset: MediaAssetEntry;
  onUpdated: () => void;
  /** Asks the page to retry fetching this asset (the page shows the confirmation). */
  onRetry?: (mediaKey: string) => void;
}

export function MediaAssetCard({
  videoId,
  mediaKey,
  asset,
  onUpdated,
  onRetry,
}: MediaAssetCardProps) {
  const [note, setNote] = useState(asset.citadel_note || "");
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [driveAuthError, setDriveAuthError] = useState(false);
  const [directUrl, setDirectUrl] = useState(asset.direct_url || "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const Icon = sourceIcons[asset.source || "stock"] || ImageIcon;
  const sourceLabel = sourceLabels[asset.source || "stock"] || asset.source || "Unknown";

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const statusPresentation = () => {
    switch (asset.status) {
      case "error":
        return { icon: AlertCircle, color: "var(--color-red)", label: "Failed" };
      case "provided":
        return { icon: CheckCircle2, color: "var(--color-green)", label: "Ready" };
      case "partial":
        return { icon: Clock, color: "var(--color-amber)", label: "Partial" };
      default:
        return { icon: Clock, color: "var(--text-faint)", label: "Pending" };
    }
  };
  const { icon: StatusIcon, color, label: statusLabel } = statusPresentation();

  const saveNote = async () => {
    setSavingNote(true);
    try {
      await fetch(`/api/videos/${videoId}/media/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_key: mediaKey, note }),
      });
      onUpdated();
    } finally {
      setSavingNote(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    setDriveAuthError(false);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/videos/${videoId}/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_key: mediaKey,
          filename: file.name,
          mime_type: file.type,
          file_base64: base64,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "DRIVE_AUTH_ERROR" || res.status === 401) {
          setDriveAuthError(true);
          throw new Error("Google Drive OAuth expired or disconnected.");
        }
        throw new Error(data.error || "Upload failed.");
      }
      onUpdated();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveDirectUrl = async () => {
    if (!directUrl.trim()) return;
    setSavingUrl(true);
    setUploadError(null);
    setDriveAuthError(false);

    try {
      const res = await fetch(`/api/videos/${videoId}/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_key: mediaKey,
          is_direct_url: true,
          direct_url: directUrl.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save direct URL.");
      }
      onUpdated();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save direct URL.");
    } finally {
      setSavingUrl(false);
    }
  };

  const primaryPrompt =
    asset.video_generation_prompt ||
    asset.image_prompt ||
    asset.animation_prompt ||
    asset.recording_instructions ||
    asset.asset_query ||
    asset.step_by_step_instructions;

  return (
    <div className="card p-4 space-y-3 border border-[var(--border)]">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
            <Icon className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text)]">Segment {mediaKey}</p>
            <p className="text-[11px] text-[var(--text-faint)]">{sourceLabel}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
          <StatusIcon className="w-4 h-4" />
          {statusLabel}
        </span>
      </div>

      {/* Drive OAuth Alert Banner */}
      {driveAuthError && (
        <div className="p-3 rounded-xl bg-[var(--color-red-soft)] border border-[var(--color-red)]/40 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-[var(--color-red)]">
              Google Drive OAuth Needs Reconnection
            </p>
            <p className="text-[var(--text)] leading-relaxed">
              Google Drive authentication failed in n8n. Please open n8n credentials to reconnect your Google Drive account, or paste a Direct URL below.
            </p>
          </div>
        </div>
      )}

      {/* Video or Image Preview */}
      {asset.driveFileId ? (
        <div className="rounded-lg overflow-hidden bg-black border border-[var(--border)]">
          <video
            src={`/api/drive/${asset.driveFileId}`}
            controls
            className="w-full max-h-56 bg-black"
            preload="metadata"
          />
        </div>
      ) : asset.direct_url ? (
        <div className="rounded-lg overflow-hidden bg-black/40 border border-[var(--border)] flex items-center justify-center max-h-56">
          <img
            src={asset.direct_url}
            alt={`Segment ${mediaKey}`}
            className="max-h-56 w-auto max-w-full object-contain"
          />
        </div>
      ) : null}

      {asset.error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-red-soft)]/60 border border-[var(--color-red)]/20">
          <AlertCircle className="w-4 h-4 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-red)] font-mono leading-relaxed">{asset.error}</p>
        </div>
      )}

      {onRetry && asset.status === "error" && (
        <button
          onClick={() => onRetry(mediaKey)}
          className="btn-amber flex items-center gap-1.5 py-1.5 px-3 text-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Retry fetching this media
        </button>
      )}

      {/* Prompts / Instructions with Copy Button */}
      {primaryPrompt && (
        <div className="bg-[var(--surface-raised)]/70 p-3 rounded-lg border border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[var(--color-purple)]" />
              Prompt & Instructions
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(primaryPrompt, "prompt")}
              className="btn-secondary text-[10px] py-0.5 px-2 flex items-center gap-1"
            >
              {copiedKey === "prompt" ? (
                <Check className="w-3 h-3 text-[var(--color-green)]" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              Copy
            </button>
          </div>
          <p className="text-xs text-[var(--text)] italic leading-relaxed">
            &ldquo;{primaryPrompt}&rdquo;
          </p>

          {asset.navigation_steps && (
            <p className="text-xs text-[var(--text-muted)]">
              <strong>Steps:</strong> {asset.navigation_steps}
            </p>
          )}
          {asset.highlight_notes && (
            <p className="text-xs text-[var(--color-purple)]">
              <strong>Highlight:</strong> {asset.highlight_notes}
            </p>
          )}
        </div>
      )}

      {asset.replaced_via_citadel_at && (
        <p className="text-[10px] text-[var(--color-purple)] font-medium">
          Manually updated via Citadel
        </p>
      )}

      {/* Note for Agent */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Note for the agent
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. this clip is too dark, try a different source..."
          rows={2}
          className="input-field text-sm resize-none py-2"
        />
        {note !== (asset.citadel_note || "") && (
          <button
            onClick={saveNote}
            disabled={savingNote}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            {savingNote ? "Saving..." : "Save note"}
          </button>
        )}
      </div>

      {/* Upload File & Direct URL Controls */}
      <div className="space-y-2 pt-2 border-t border-[var(--border)]">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? "Uploading..." : asset.driveFileId ? "Replace File" : "Upload File"}
          </button>

          <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="Or paste Direct URL..."
              className="input-field text-xs py-1.5 flex-1"
            />
            <button
              onClick={handleSaveDirectUrl}
              disabled={savingUrl || !directUrl.trim() || directUrl === asset.direct_url}
              className="btn-secondary text-xs py-1.5 px-2.5 disabled:opacity-40"
            >
              {savingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save URL"}
            </button>
          </div>
        </div>

        {uploadError && <p className="text-xs text-[var(--color-red)] mt-1">{uploadError}</p>}
      </div>
    </div>
  );
}
