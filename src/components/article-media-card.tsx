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
  Copy,
  Check,
  ExternalLink,
  Link as LinkIcon,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";
import type { ArticleMediaInstruction } from "@/lib/article-types";

interface ArticleMediaCardProps {
  articleId: string;
  instruction: ArticleMediaInstruction;
  onUpdated: () => void;
}

export function ArticleMediaCard({
  articleId,
  instruction,
  onUpdated,
}: ArticleMediaCardProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [directUrl, setDirectUrl] = useState(instruction.direct_url || "");
  const [savingUrl, setSavingUrl] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [driveAuthError, setDriveAuthError] = useState(false);
  const [note, setNote] = useState(instruction.notes || "");
  const [savingNote, setSavingNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUploaded =
    Boolean(instruction.uploaded) ||
    Boolean(instruction.drive_file_id) ||
    Boolean(instruction.direct_url);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyFullGuide = () => {
    const parts = [
      `Media #${instruction.index}: ${instruction.title}`,
      instruction.target_url ? `Website / Target URL: ${instruction.target_url}` : null,
      instruction.navigation_steps ? `Navigation & Search: ${instruction.navigation_steps}` : null,
      instruction.capture_area ? `Capture Area: ${instruction.capture_area}` : null,
      instruction.highlight_notes ? `Highlight & Markings: ${instruction.highlight_notes}` : null,
      instruction.caption ? `Caption: ${instruction.caption}` : null,
      instruction.ai_prompt ? `AI Prompt: ${instruction.ai_prompt}` : null,
    ].filter(Boolean);

    copyToClipboard(parts.join("\n\n"), "guide");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      const res = await fetch(`/api/articles/${articleId}/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_index: instruction.index,
          placeholder_id: instruction.placeholder_id,
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
        throw new Error(data.error || "File upload failed.");
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
      const res = await fetch(`/api/articles/${articleId}/media/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_index: instruction.index,
          placeholder_id: instruction.placeholder_id,
          is_direct_url: true,
          direct_url: directUrl.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not save direct URL.");
      }

      onUpdated();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to save direct URL.");
    } finally {
      setSavingUrl(false);
    }
  };

  const handleSaveNote = async () => {
    setSavingNote(true);
    try {
      await fetch(`/api/articles/${articleId}/media/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeholder_id: instruction.placeholder_id,
          media_index: instruction.index,
          notes: note,
        }),
      });
      onUpdated();
    } finally {
      setSavingNote(false);
    }
  };

  const isAi = instruction.type === "ai_prompt" || Boolean(instruction.ai_prompt);
  const isScreenshot = instruction.type === "screenshot" || Boolean(instruction.navigation_steps);

  return (
    <div className="card p-5 space-y-4 border border-[var(--border)]">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)]">
            {isAi ? (
              <Sparkles className="w-4 h-4 text-[var(--color-purple)]" />
            ) : isScreenshot ? (
              <Camera className="w-4 h-4 text-[var(--color-blue,var(--text-muted))]" />
            ) : (
              <ImageIcon className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--text)]">
                Media #{instruction.index}: {instruction.title || "Instruction"}
              </span>
              <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--color-purple)]">
                {instruction.placeholder_id}
              </code>
            </div>
            <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
              Type: {instruction.type || (isAi ? "AI Generated" : "Screenshot / Graphic")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isUploaded ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-green)] bg-[var(--color-green-soft)] px-2.5 py-1 rounded-full border border-[var(--color-green)]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Media Ready
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-amber)] bg-[var(--color-amber-soft)] px-2.5 py-1 rounded-full border border-[var(--color-amber)]/30">
              <Clock className="w-3.5 h-3.5" />
              Pending Upload
            </span>
          )}
        </div>
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
              Google Drive returned an authentication error in n8n. Please open your n8n workspace, navigate to Credentials, and reconnect your Google Drive OAuth account. Alternatively, you can paste a <strong>Direct URL</strong> below.
            </p>
          </div>
        </div>
      )}

      {/* Target URL if applicable */}
      {instruction.target_url && (
        <div className="flex items-center gap-2 text-xs bg-[var(--surface-raised)] p-2.5 rounded-lg border border-[var(--border)]">
          <LinkIcon className="w-3.5 h-3.5 text-[var(--color-purple)] flex-shrink-0" />
          <span className="text-[var(--text-faint)]">Target Website:</span>
          <a
            href={instruction.target_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-purple)] font-medium hover:underline inline-flex items-center gap-1 truncate"
          >
            {instruction.target_url}
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        </div>
      )}

      {/* Step by Step Breakdown */}
      <div className="space-y-3 bg-[var(--surface-raised)]/60 p-3.5 rounded-xl border border-[var(--border)] text-xs">
        {instruction.navigation_steps && (
          <div>
            <span className="font-semibold text-[var(--text-muted)] block mb-1">
              🔍 Navigation & Search Steps:
            </span>
            <p className="text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {instruction.navigation_steps}
            </p>
          </div>
        )}

        {instruction.capture_area && (
          <div>
            <span className="font-semibold text-[var(--text-muted)] block mb-1">
              📸 Capture Area / Screenshot Frame:
            </span>
            <p className="text-[var(--text)] leading-relaxed">
              {instruction.capture_area}
            </p>
          </div>
        )}

        {instruction.highlight_notes && (
          <div>
            <span className="font-semibold text-[var(--color-purple)] block mb-1">
              🎨 Colored Shape & Highlight Notes:
            </span>
            <p className="text-[var(--text)] leading-relaxed bg-[var(--color-purple-soft)]/50 p-2.5 rounded-lg border border-[var(--color-purple)]/20">
              {instruction.highlight_notes}
            </p>
          </div>
        )}

        {instruction.ai_prompt && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-[var(--text-muted)] flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-[var(--color-purple)]" />
                AI Generation Prompt:
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(instruction.ai_prompt || "", "prompt")}
                className="btn-secondary text-[10px] py-0.5 px-2 flex items-center gap-1"
              >
                {copiedKey === "prompt" ? (
                  <Check className="w-3 h-3 text-[var(--color-green)]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                Copy Prompt
              </button>
            </div>
            <p className="text-[var(--text)] italic bg-[var(--surface-raised)] p-2.5 rounded-lg border border-[var(--border)]">
              &ldquo;{instruction.ai_prompt}&rdquo;
            </p>
          </div>
        )}

        {instruction.caption && (
          <div>
            <span className="font-semibold text-[var(--text-muted)] block mb-0.5">
              Caption in Article:
            </span>
            <p className="text-[var(--text-faint)] italic">&ldquo;{instruction.caption}&rdquo;</p>
          </div>
        )}

        {/* Action Copy Buttons */}
        <div className="flex items-center gap-2 pt-1 flex-wrap">
          <button
            type="button"
            onClick={copyFullGuide}
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            {copiedKey === "guide" ? (
              <Check className="w-3.5 h-3.5 text-[var(--color-green)]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy Full Instructions
          </button>

          <button
            type="button"
            onClick={() =>
              copyToClipboard(
                `<!-- MEDIA_PLACEHOLDER:${instruction.placeholder_id} -->`,
                "placeholder"
              )
            }
            className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
          >
            {copiedKey === "placeholder" ? (
              <Check className="w-3.5 h-3.5 text-[var(--color-green)]" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            Copy Placeholder Tag
          </button>
        </div>
      </div>

      {/* Media Preview (Drive Image or Direct URL) */}
      {(instruction.drive_file_id || instruction.direct_url) && (
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Uploaded Media Preview
          </label>
          <div className="relative rounded-xl overflow-hidden border border-[var(--border)] bg-black/40 flex items-center justify-center max-h-72">
            <img
              src={
                instruction.direct_url
                  ? instruction.direct_url
                  : `https://lh3.googleusercontent.com/d/${instruction.drive_file_id}=w800`
              }
              alt={instruction.title}
              className="max-h-72 w-auto max-w-full object-contain"
              onError={(e) => {
                if (instruction.drive_file_id) {
                  (e.target as HTMLImageElement).src = `https://drive.google.com/thumbnail?id=${instruction.drive_file_id}&sz=w800`;
                }
              }}
            />
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-faint)] flex-wrap">
            {instruction.drive_file_id && (
              <span>
                Drive ID: <code className="text-[var(--text-muted)]">{instruction.drive_file_id}</code>
              </span>
            )}
            {instruction.wordpress_media_id && (
              <span className="text-[var(--color-green)] font-medium">
                WordPress Media ID: #{instruction.wordpress_media_id}
              </span>
            )}
            {instruction.drive_url && (
              <a
                href={instruction.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-purple)] hover:underline inline-flex items-center gap-1"
              >
                Drive Link
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Upload & Direct URL Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
        {/* Option 1: File Upload */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Upload from Computer (Google Drive)
          </label>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--color-purple)]" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-[var(--color-purple)]" />
              )}
              {uploading
                ? "Uploading to Drive..."
                : isUploaded
                ? "Replace Media File"
                : "Upload Media File"}
            </button>
          </div>
        </div>

        {/* Option 2: Direct Hosted URL */}
        <div className="space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Or Paste Direct Hosted URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={directUrl}
              onChange={(e) => setDirectUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              className="input-field text-xs py-2 flex-1"
            />
            <button
              type="button"
              onClick={handleSaveDirectUrl}
              disabled={savingUrl || !directUrl.trim() || directUrl === instruction.direct_url}
              className="btn-secondary text-xs py-2 px-3 disabled:opacity-40 flex items-center gap-1"
            >
              {savingUrl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-[var(--color-red)] flex items-center gap-1 mt-1">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {uploadError}
        </p>
      )}

      {/* Note for the Agent / Review Feedback */}
      <div className="space-y-1.5 pt-2 border-t border-[var(--border)]">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center justify-between">
          <span>Note / Review Feedback for this Media</span>
          {instruction.notes && (
            <span className="text-[var(--color-green)] text-[10px]">Saved</span>
          )}
        </label>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Navigation step #2 was unclear; highlight rectangle needs to be in red..."
          className="input-field text-xs resize-none py-2"
        />
        {note !== (instruction.notes || "") && (
          <button
            type="button"
            onClick={handleSaveNote}
            disabled={savingNote}
            className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50"
          >
            {savingNote ? "Saving note..." : "Save note"}
          </button>
        )}
      </div>
    </div>
  );
}
