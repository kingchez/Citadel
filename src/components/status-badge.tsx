import type { VideoStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<string, { label: string; tone: "success" | "warning" | "danger" | "info" | "muted" }> = {
  planning: { label: "Planning", tone: "muted" },
  script_written: { label: "Script written", tone: "muted" },
  waiting_voiceover: { label: "Voiceover running", tone: "info" },
  partial_voiceover: { label: "Voiceover partial", tone: "warning" },
  voiceover_error: { label: "Voiceover error", tone: "danger" },
  voiceover_done: { label: "Voiceover done", tone: "muted" },
  waiting_voice_timing: { label: "Word timing running", tone: "info" },
  partial_voice_timing: { label: "Word timing partial", tone: "warning" },
  voice_timing_error: { label: "Word timing error", tone: "danger" },
  voice_timing_done: { label: "Word timing done", tone: "muted" },
  scenes_planned: { label: "Scenes planned", tone: "muted" },
  awaiting_media: { label: "Awaiting media", tone: "info" },
  media_review: { label: "Media review", tone: "warning" },
  media_ready: { label: "Media ready", tone: "muted" },
  final_scene_planned: { label: "Ready to render", tone: "muted" },
  rendering: { label: "Rendering", tone: "info" },
  render_error: { label: "Render error", tone: "danger" },
  production_review: { label: "Final review", tone: "warning" },
  retrying: { label: "Retrying", tone: "info" },
  done: { label: "Done", tone: "success" },
  shipped: { label: "Shipped", tone: "success" },
};

const TONE_CLASSES: Record<string, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  muted: "bg-bg text-text-muted",
};

export function StatusBadge({ status }: { status: VideoStatus | string }) {
  const config = STATUS_STYLE[status] ?? { label: status, tone: "muted" as const };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        TONE_CLASSES[config.tone]
      )}
    >
      {config.label}
    </span>
  );
}
