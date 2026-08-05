"use client";

import { useState } from "react";
import { RotateCw, Check } from "lucide-react";
import { Button } from "./ui/button";
import type { RetryService } from "@/lib/types";

interface Props {
  videoId: string;
  service: RetryService;
  target: { segment_index?: number; clip_index?: number; code?: string } | null;
  onQueued?: () => void;
}

export function RetryButton({ videoId, service, target, onQueued }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "queued" | "error">("idle");

  async function handleRetry() {
    setState("loading");
    try {
      const res = await fetch("/api/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, service, target }),
      });
      if (!res.ok) throw new Error();
      setState("queued");
      onQueued?.();
    } catch {
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
        <Check className="h-3.5 w-3.5" /> Queued
      </span>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={handleRetry}
      disabled={state === "loading"}
      className="!px-2.5 !py-1 text-xs"
    >
      <RotateCw className={`h-3 w-3 ${state === "loading" ? "animate-spin" : ""}`} />
      {state === "error" ? "Retry failed — try again" : "Retry"}
    </Button>
  );
}
