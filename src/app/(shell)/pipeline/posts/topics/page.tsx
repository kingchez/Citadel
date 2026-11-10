"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  Tag,
} from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ContentTopicRow } from "@/lib/article-types";

const CHANNELS = [
  "Viral Shop",
  "The Daily Signal",
  "Capital Code",
  "Pure Pulse",
  "Insight Within",
  "Curious Atlas",
  "Reel Talk",
  "Taste the World",
  "Wild & Whiskered",
  "Game Point",
  "Full Throttle",
  "Flow Nation",
];

export default function TopicsPage() {
  const [topics, setTopics] = useState<ContentTopicRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formChannel, setFormChannel] = useState("Viral Shop");
  const [formCategory, setFormCategory] = useState("Shopping");
  const [formTitle, setFormTitle] = useState("");
  const [formKeywords, setFormKeywords] = useState("");
  const [formWeek, setFormWeek] = useState("2026-W46");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTopics = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load topics");
      setTopics(data.topics as ContentTopicRow[]);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const handleCreateTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const keywordsArray = formKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const res = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: formChannel,
          category: formCategory,
          topic_title: formTitle.trim(),
          target_keywords: keywordsArray,
          target_week: formWeek.trim(),
          notes: formNotes.trim() || null,
          status: "approved",
        }),
      });

      if (!res.ok) throw new Error("Failed to save topic");
      setFormTitle("");
      setFormKeywords("");
      setFormNotes("");
      setShowAddModal(false);
      loadTopics();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <Link
        href="/pipeline/posts"
        className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Articles & Posts
      </Link>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--color-purple)]" />
            Weekly Strategy Topics
          </h1>
          <p className="text-xs text-[var(--text-faint)] mt-1">
            Topics locked in during Thursday strategy sessions for the Cloud Antigravity Agent to research and draft.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-purple text-xs flex items-center gap-1.5 py-2 px-3.5"
        >
          <Plus className="w-4 h-4" />
          Add Topic
        </button>
      </div>

      {loading && (
        <div className="p-8 text-center text-xs text-[var(--text-faint)] flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-purple)]" />
          Loading topics...
        </div>
      )}

      {topics && topics.length === 0 && (
        <div className="card p-10 text-center space-y-2">
          <Sparkles className="w-10 h-10 mx-auto text-[var(--border-strong)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">No topics scheduled yet</h3>
          <p className="text-xs text-[var(--text-faint)] max-w-sm mx-auto">
            Click &quot;Add Topic&quot; to register topics agreed during your Thursday strategy session.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {(topics || []).map((topic) => (
          <div
            key={topic.id}
            className="card p-4 space-y-2 border border-[var(--border)] hover:bg-[var(--surface-raised)] transition-all"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-purple text-xs font-semibold">{topic.channel}</span>
                {topic.category && (
                  <span className="text-xs text-[var(--text-faint)]">· {topic.category}</span>
                )}
                {topic.target_week && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)] flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {topic.target_week}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "badge text-xs flex items-center gap-1",
                  topic.status === "completed"
                    ? "badge-green"
                    : topic.status === "in_progress"
                    ? "badge-cyan"
                    : "badge-purple"
                )}
              >
                {topic.status === "completed" ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span className="capitalize">{topic.status}</span>
              </span>
            </div>

            <h3 className="text-sm font-semibold text-[var(--text)]">{topic.topic_title}</h3>

            {topic.notes && (
              <p className="text-xs text-[var(--text-muted)] bg-[var(--surface-raised)] p-2.5 rounded-lg border border-[var(--border)]">
                {topic.notes}
              </p>
            )}

            <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--text-faint)] flex-wrap gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="w-3 h-3" />
                {(topic.target_keywords || []).map((kw, i) => (
                  <span key={i} className="px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
                    {kw}
                  </span>
                ))}
              </div>
              <span>Added {formatTimeAgo(topic.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateTopic}
            className="card max-w-lg w-full p-6 space-y-4 animate-scale-up"
          >
            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--color-purple)]" />
              Add Strategy Topic
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Channel
                </label>
                <select
                  value={formChannel}
                  onChange={(e) => setFormChannel(e.target.value)}
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                >
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Shopping, Tech, Gadgets"
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Topic Title / Headline
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 5 Best Standing Desks Under $300 (2026)"
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Target Keywords (comma-separated)
                </label>
                <input
                  type="text"
                  value={formKeywords}
                  onChange={(e) => setFormKeywords(e.target.value)}
                  placeholder="standing desk, ergonomic home office, best desk 2026"
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Target Week
                </label>
                <input
                  type="text"
                  value={formWeek}
                  onChange={(e) => setFormWeek(e.target.value)}
                  placeholder="e.g. 2026-W46"
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                />
              </div>

              <div>
                <label className="font-semibold text-[var(--text-muted)] block mb-1">
                  Editorial Notes (Instructions for Agent)
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Focus on motorized dual-motor desks with cable management..."
                  className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formTitle.trim()}
                className="btn-purple text-xs py-2 px-4 disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Topic"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
