"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Play, Pause, ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScriptSegment } from "@/lib/types";

interface SegmentRowProps {
  segment: ScriptSegment;
  selected: boolean;
  onSelect: (index: number, checked: boolean) => void;
  onRetry: (index: number) => void;
  onPlay: (index: number) => void;
  isPlaying: boolean;
  /** True when there's a pending/dispatched retry row for this segment -
   * i.e. it's genuinely queued to be regenerated, whether that retry came
   * from the retry icon or from approving a retry after an edit. */
  retryQueued?: boolean;
}

export function SegmentRow({ segment, selected, onSelect, onRetry, onPlay, isPlaying, retryQueued }: SegmentRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasAudio = !!segment.voiceover_drive_file_id;
  const isError = !!segment.error;
  const isSuccess = !isError && hasAudio && !retryQueued;
  const text = segment.text || "";

  return (
    <div
      className={cn(
        "segment-row rounded-xl border px-4 py-3 transition-all duration-150",
        selected
          ? "bg-[var(--color-purple-soft)]/40 border-[var(--color-purple)]/60"
          : isError
          ? "bg-[var(--color-red-soft)]/40 border-[var(--color-red)]/30 border-l-[3px] border-l-[var(--color-red)]"
          : "bg-[var(--surface)] border-[var(--border)] hover:border-[var(--border-strong)]"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <input
            type="checkbox"
            className="custom-checkbox"
            checked={selected}
            onChange={(e) => onSelect(segment.index, e.target.checked)}
            aria-label={`Select segment ${segment.index + 1}`}
          />
        </div>

        <div className="flex-shrink-0 w-8 pt-0.5">
          <span className="text-sm font-mono text-[var(--text-faint)] font-medium">
            {String(segment.index + 1).padStart(2, "0")}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className={cn("text-sm text-[var(--text)] leading-relaxed", !expanded && "line-clamp-2")}>{text}</p>

          {text.length > 120 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  <span>Collapse</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  <span>Read more</span>
                </>
              )}
            </button>
          )}

          {isError && segment.error && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-red-soft)]/50 border border-[var(--color-red)]/20">
              <AlertCircle className="w-4 h-4 text-[var(--color-red)] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-red)] font-mono leading-relaxed">{segment.error}</p>
            </div>
          )}

          {segment.edited_pending_retry && !retryQueued && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-[var(--color-amber-soft)]/60 border border-[var(--color-amber)]/30">
              <AlertCircle className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0" />
              <p className="text-xs text-[var(--color-amber)] font-medium">
                Text was edited after this segment&apos;s audio was generated — audio no longer matches. Click retry to regenerate.
              </p>
            </div>
          )}

          {retryQueued && (
            <div className="mt-2 flex items-center gap-2 p-2.5 rounded-lg bg-[var(--color-amber-soft)]/40 border border-[var(--color-amber)]/20">
              <RotateCw className="w-4 h-4 text-[var(--color-amber)] flex-shrink-0" />
              <p className="text-xs text-[var(--color-amber)] font-medium">
                Queued for retry — the audio you hear below is still the old version until this finishes.
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 pt-0.5">
          {retryQueued ? (
            <span title="Retry queued">
              <RotateCw className="w-5 h-5 text-[var(--color-amber)]" />
            </span>
          ) : isSuccess ? (
            <CheckCircle2 className="w-5 h-5 text-[var(--color-green)]" />
          ) : isError ? (
            <AlertCircle className="w-5 h-5 text-[var(--color-red)]" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-[var(--text-faint)] border-t-[var(--text-muted)] animate-spin" />
          )}
        </div>

        <div className="flex-shrink-0">
          {hasAudio ? (
            <button
              onClick={() => onPlay(segment.index)}
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150",
                isPlaying ? "bg-[var(--color-cyan)] shadow-[0_0_16px_var(--color-cyan-glow)]" : "bg-[var(--color-cyan-soft)] hover:bg-[var(--color-cyan)] hover:shadow-[0_0_16px_var(--color-cyan-glow)]"
              )}
              aria-label={isPlaying ? "Pause segment audio" : "Play segment audio"}
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-[var(--color-cyan)] ml-0.5" />}
            </button>
          ) : (
            <div className="w-9 h-9 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center">
              <Play className="w-4 h-4 text-[var(--text-faint)]" />
            </div>
          )}
        </div>

        <div className="flex-shrink-0">
          <button
            onClick={() => onRetry(segment.index)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-[var(--color-amber)] hover:bg-[var(--color-amber-soft)] border border-transparent hover:border-[var(--color-amber)]/30 transition-all duration-150"
            aria-label={`Retry segment ${segment.index + 1}`}
            title="Retry this segment"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AudioPlayerProps {
  segmentIndex: number;
  segmentText: string;
  fileId: string;
  src?: string;
  onClose: () => void;
}

export function AudioPlayerBar({ segmentIndex, segmentText, fileId, src, onClose }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const waveformBars = Array.from({ length: 24 }, (_, i) => i);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.play().catch(() => {});
    setPlaying(true);
  }, [fileId]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      el.play().catch(() => {});
    }
  };

  const formatTime = (t: number) => {
    if (!Number.isFinite(t)) return "0:00";
    const mins = Math.floor(t / 60);
    const secs = Math.floor(t % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-[var(--bg)] border border-[var(--border)] rounded-xl mt-3">
      <audio
        ref={audioRef}
        src={src || `/api/drive/${fileId}`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          onClose();
        }}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />

      <button
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-[var(--color-cyan)] flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-opacity shadow-[0_0_16px_var(--color-cyan-glow)]"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>

      <div className="flex-shrink-0">
        <p className="text-xs font-semibold text-[var(--text)]">Segment {String(segmentIndex + 1).padStart(2, "0")}</p>
        <p className="text-[10px] text-[var(--text-faint)] truncate max-w-[160px]">{segmentText}</p>
      </div>

      <div className="flex items-center gap-[2px] flex-1 h-8">
        {waveformBars.map((i) => (
          <div
            key={i}
            className={cn("w-1 rounded-full bg-[var(--color-cyan)] flex-1", playing ? "waveform-bar" : "h-1 opacity-40")}
            style={playing ? { animationDelay: `${i * 0.04}s`, animationDuration: `${0.4 + (i % 5) * 0.08}s` } : {}}
          />
        ))}
      </div>

      <div className="flex-shrink-0 text-xs font-mono text-[var(--text-faint)]">
        {formatTime(currentTime)} / {formatTime(duration)}
      </div>

      <button
        onClick={onClose}
        className="flex-shrink-0 text-[10px] text-[var(--color-cyan)] hover:opacity-80 underline"
      >
        Close
      </button>
    </div>
  );
}
