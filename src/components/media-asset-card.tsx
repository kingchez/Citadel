"use client";

import { useState, useRef } from "react";
import { Image as ImageIcon, Camera, Sparkles, Upload, AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react";
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
}

export function MediaAssetCard({ videoId, mediaKey, asset, onUpdated }: MediaAssetCardProps) {
  const [note, setNote] = useState(asset.citadel_note || "");
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const Icon = sourceIcons[asset.source || "stock"] || ImageIcon;
  const sourceLabel = sourceLabels[asset.source || "stock"] || asset.source || "Unknown";

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
        body: JSON.stringify({ media_key: mediaKey, filename: file.name, mime_type: file.type, file_base64: base64 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--surface-raised)]">
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

      {asset.driveFileId && (
        <div className="rounded-lg overflow-hidden bg-black border border-[var(--border)]">
          <video src={`/api/drive/${asset.driveFileId}`} controls className="w-full max-h-56 bg-black" preload="metadata" />
        </div>
      )}

      {asset.error && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-red-soft)]/60 border border-[var(--color-red)]/20">
          <AlertCircle className="w-4 h-4 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-red)] font-mono leading-relaxed">{asset.error}</p>
        </div>
      )}

      {(asset.asset_query || asset.video_generation_prompt || asset.image_prompt || asset.recording_instructions) && (
        <p className="text-xs text-[var(--text-faint)] italic">
          &ldquo;{asset.asset_query || asset.video_generation_prompt || asset.image_prompt || asset.recording_instructions}&rdquo;
        </p>
      )}

      {asset.replaced_via_citadel_at && (
        <p className="text-[10px] text-[var(--color-purple)] font-medium">Manually replaced via Citadel</p>
      )}

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
          <button onClick={saveNote} disabled={savingNote} className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50">
            {savingNote ? "Saving..." : "Save note"}
          </button>
        )}
      </div>

      <div>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Uploading..." : "Replace media"}
        </button>
        {uploadError && <p className="text-xs text-[var(--color-red)] mt-1.5">{uploadError}</p>}
      </div>
    </div>
  );
}
