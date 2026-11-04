"use client";

import { useState } from "react";
import type { MediaItem } from "@/lib/news-types";
import { formatTimecode, parseTimecode, isImageUrl } from "@/lib/news-types";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Trash2 } from "lucide-react";

interface DraftMediaItem {
  id: number;
  type: "image" | "clip";
  url: string;
  start: string;
  end: string;
  description: string;
}

let nextId = 1;

function itemToDraft(item: MediaItem): DraftMediaItem {
  if (item.type === "image") {
    return {
      id: nextId++,
      type: "image",
      url: item.url,
      start: "",
      end: "",
      description: item.description || "",
    };
  }
  return {
    id: nextId++,
    type: "clip",
    url: item.url,
    start: formatTimecode(item.start),
    end: formatTimecode(item.end),
    description: item.description || "",
  };
}

function draftToItem(draft: DraftMediaItem): MediaItem | null {
  if (!draft.url.trim()) return null;
  if (draft.type === "image") {
    return {
      type: "image",
      url: draft.url.trim(),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
    };
  }
  const s = parseTimecode(draft.start);
  const e = parseTimecode(draft.end);
  if (s === null || e === null || e <= s) return null;
  return {
    type: "clip",
    url: draft.url.trim(),
    start: s,
    end: e,
    ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
  };
}

export function MediaClipsBuilder({
  items,
  onChange,
  defaultUrl = "",
}: {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  defaultUrl?: string;
}) {
  const [drafts, setDrafts] = useState<DraftMediaItem[]>(() => {
    if (items && items.length > 0) return items.map(itemToDraft);
    if (defaultUrl.trim()) {
      return [
        {
          id: nextId++,
          type: isImageUrl(defaultUrl) ? "image" : "clip",
          url: defaultUrl.trim(),
          start: isImageUrl(defaultUrl) ? "" : "0:00",
          end: isImageUrl(defaultUrl) ? "" : "0:10",
          description: "",
        },
      ];
    }
    return [];
  });

  const sync = (next: DraftMediaItem[]) => {
    setDrafts(next);
    const converted: MediaItem[] = [];
    for (const d of next) {
      const it = draftToItem(d);
      if (it) converted.push(it);
    }
    onChange(converted);
  };

  const addItem = (type: "image" | "clip") => {
    const next: DraftMediaItem[] = [
      ...drafts,
      {
        id: nextId++,
        type,
        url: defaultUrl.trim(),
        start: type === "clip" ? "0:00" : "",
        end: type === "clip" ? "0:08" : "",
        description: "",
      },
    ];
    sync(next);
  };

  const updateDraft = (id: number, patch: Partial<DraftMediaItem>) => {
    const next = drafts.map((d) => (d.id === id ? { ...d, ...patch } : d));
    sync(next);
  };

  const removeDraft = (id: number) => {
    const next = drafts.filter((d) => d.id !== id);
    sync(next);
  };

  const moveDraft = (id: number, dir: -1 | 1) => {
    const idx = drafts.findIndex((d) => d.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= drafts.length) return;
    const next = [...drafts];
    [next[idx], next[target]] = [next[target], next[idx]];
    sync(next);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Ordered Clips & Images for Canva
        </label>
        <span className="text-xs text-[var(--text-faint)]">
          {drafts.length} item{drafts.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-xs text-[var(--text-faint)]">
        Provide each clip or image in order with a short description of what is shown. Descriptions are used to generate the scene captions in Canva.
      </p>

      {drafts.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-xs text-[var(--text-faint)]">
          No clips or images added yet. Click &quot;+ Add clip&quot; or &quot;+ Add image&quot; below.
        </div>
      )}

      <div className="space-y-2.5">
        {drafts.map((d, idx) => (
          <div key={d.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/40 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono font-semibold text-[var(--color-purple)]">
                #{idx + 1} {d.type === "clip" ? "Video Clip" : "Still Image"}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveDraft(d.id, -1)}
                  disabled={idx === 0}
                  className="btn-ghost p-1 disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveDraft(d.id, 1)}
                  disabled={idx === drafts.length - 1}
                  className="btn-ghost p-1 disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeDraft(d.id)}
                  className="btn-ghost p-1 text-[var(--color-red)]"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2 items-center">
                <input
                  className="input-field text-xs font-mono flex-1"
                  value={d.url}
                  onChange={(e) => updateDraft(d.id, { url: e.target.value })}
                  placeholder="URL (YouTube, TikTok, MP4 file, image URL)"
                />
                {d.url.trim() && (
                  <a
                    href={d.url.trim()}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost text-xs p-1.5 flex-shrink-0"
                    title="Open link"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {d.type === "clip" && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider block mb-1">
                      Start Time (e.g. 0:00 or 12)
                    </label>
                    <input
                      className="input-field text-xs font-mono"
                      value={d.start}
                      onChange={(e) => updateDraft(d.id, { start: e.target.value })}
                      placeholder="0:00"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider block mb-1">
                      End Time (e.g. 0:10 or 22)
                    </label>
                    <input
                      className="input-field text-xs font-mono"
                      value={d.end}
                      onChange={(e) => updateDraft(d.id, { end: e.target.value })}
                      placeholder="0:10"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider block mb-1">
                  Description (Required for captions)
                </label>
                <input
                  className="input-field text-xs"
                  value={d.description}
                  onChange={(e) => updateDraft(d.id, { description: e.target.value })}
                  placeholder="What happens here or what does this show?"
                  maxLength={500}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => addItem("clip")}
          className="btn-secondary text-xs !py-1.5 px-3 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add clip
        </button>
        <button
          type="button"
          onClick={() => addItem("image")}
          className="btn-secondary text-xs !py-1.5 px-3 flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Add image
        </button>
      </div>
    </div>
  );
}
