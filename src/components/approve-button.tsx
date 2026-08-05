"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";

interface Props {
  videoId: string;
  currentStatus: string;
  label: string;
  onApproved?: () => void;
}

export function ApproveButton({ videoId, currentStatus, label, onApproved }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function handleApprove() {
    setState("loading");
    try {
      const res = await fetch(`/api/videos/${videoId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_status: currentStatus }),
      });
      if (!res.ok) throw new Error();
      onApproved?.();
    } catch {
      setState("error");
      return;
    }
    setState("idle");
  }

  return (
    <Button variant="primary" onClick={handleApprove} disabled={state === "loading"}>
      <CheckCircle2 className="h-4 w-4" />
      {state === "loading" ? "Approving…" : state === "error" ? "Failed — try again" : label}
    </Button>
  );
}
