"use client";

import { cn } from "@/lib/utils";
import type { VideoStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import {
  FileText,
  Mic,
  Mic2,
  CheckCircle,
  Clock,
  LayoutGrid,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
  MessageSquareWarning,
  RotateCw,
  CheckCircle2,
  Truck,
  AlertOctagon,
} from "lucide-react";

const PULSING_STATUSES = new Set<VideoStatus>([
  "rendering",
  "waiting_voiceover",
  "partial_voiceover",
  "waiting_voice_timing",
  "partial_voice_timing",
  "retrying",
]);

const statusIcons: Partial<Record<VideoStatus, React.ElementType>> = {
  planning: FileText,
  script_written: FileText,
  waiting_voiceover: Mic,
  partial_voiceover: Mic2,
  voiceover_error: AlertTriangle,
  voiceover_done: CheckCircle,
  waiting_voice_timing: Clock,
  partial_voice_timing: Clock,
  voice_timing_error: AlertTriangle,
  voice_timing_done: Clock,
  scenes_planned: LayoutGrid,
  awaiting_media: LayoutGrid,
  media_review: ClipboardCheck,
  media_ready: CheckCircle,
  final_scene_planned: LayoutGrid,
  rendering: Loader2,
  render_error: AlertTriangle,
  production_review: ClipboardCheck,
  revision_requested: MessageSquareWarning,
  retrying: RotateCw,
  done: CheckCircle2,
  shipped: Truck,
  chatterbox_delivery_stuck: AlertOctagon,
  whisperx_delivery_stuck: AlertOctagon,
  render_delivery_stuck: AlertOctagon,
  autobrowse_delivery_stuck: AlertOctagon,
};

interface StatusBadgeProps {
  status: VideoStatus;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export function StatusBadge({ status, size = "md", showIcon = true, className }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] ?? status;
  const color = STATUS_COLORS[status] ?? "purple";
  const Icon = statusIcons[status] ?? FileText;
  const pulsing = PULSING_STATUSES.has(status);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
    lg: "px-4 py-1.5 text-sm gap-2",
  };

  const iconSize = { sm: "w-3 h-3", md: "w-3.5 h-3.5", lg: "w-4 h-4" };

  return (
    <span className={cn("badge", `badge-${color}`, sizeClasses[size], className)}>
      {showIcon && (
        <span className="flex-shrink-0">
          <Icon className={cn(iconSize[size], pulsing && "animate-spin")} />
        </span>
      )}
      <span className="whitespace-nowrap normal-case tracking-normal font-semibold">{label}</span>
    </span>
  );
}

interface StatusDotProps {
  status: VideoStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const statusDotSizes = { sm: "w-2 h-2", md: "w-3 h-3", lg: "w-4 h-4" };

export function StatusDot({ status, size = "md", className }: StatusDotProps) {
  const color = STATUS_COLORS[status] ?? "purple";
  const pulsing = PULSING_STATUSES.has(status);

  return (
    <span
      className={cn("rounded-full flex-shrink-0", statusDotSizes[size], pulsing && "status-pulse", className)}
      style={{
        backgroundColor: `var(--color-${color})`,
        boxShadow: `0 0 8px var(--color-${color}-glow)`,
      }}
    />
  );
}
