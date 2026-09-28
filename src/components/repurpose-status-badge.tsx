"use client";

import { cn } from "@/lib/utils";
import { REPURPOSE_STATUS_COLORS, REPURPOSE_STATUS_LABELS, type RepurposeStatus } from "@/lib/repurpose-types";

const PULSING = new Set<RepurposeStatus>(["splitting", "waiting_voice_timing"]);

export function RepurposeStatusBadge({ status, className }: { status: RepurposeStatus; className?: string }) {
  const color = REPURPOSE_STATUS_COLORS[status] ?? "purple";
  return (
    <span className={cn("badge", `badge-${color}`, "px-2 py-0.5 text-[10px] gap-1", className)}>
      {PULSING.has(status) && <span className="w-1.5 h-1.5 rounded-full bg-current status-pulse" />}
      <span className="whitespace-nowrap normal-case tracking-normal font-semibold">
        {REPURPOSE_STATUS_LABELS[status] ?? status}
      </span>
    </span>
  );
}
