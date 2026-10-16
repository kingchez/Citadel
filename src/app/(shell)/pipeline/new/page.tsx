"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { AddByLink } from "@/components/add-by-link";
import { AddByChannel } from "@/components/add-by-channel";

type Section = "link" | "channel";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "link", label: "Add by Link" },
  { key: "channel", label: "Add by Channel" },
];

export default function AddVideoPage() {
  const [section, setSection] = useState<Section>("link");

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className={cn("mx-auto space-y-4", section === "channel" ? "max-w-6xl" : "max-w-3xl")}>
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Add Video</h1>
          <p className="text-sm text-[var(--text-faint)] mt-1">
            {section === "link"
              ? "Insert a new Viral Shop video, or queue an existing one to be repurposed."
              : "Review videos scraped from your channels and queue the ones you want to repurpose."}
          </p>
        </div>

        <div role="tablist" aria-label="How to add a video" className="inline-flex w-full sm:w-auto p-1 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={section === s.key}
              onClick={() => setSection(s.key)}
              className={cn(
                "flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                section === s.key ? "bg-[var(--color-purple-soft)] text-[var(--color-purple)]" : "text-[var(--text-muted)] hover:text-[var(--text)]"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {section === "link" ? <AddByLink /> : <AddByChannel />}
    </div>
  );
}
