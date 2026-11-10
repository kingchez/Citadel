"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Loader2,
  ChevronRight,
  Filter,
  ShoppingCart,
  MessageSquareWarning,
  Sparkles,
} from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ArticleRow, ArticleStatus } from "@/lib/article-types";
import { ArticleStatusBadge } from "@/components/article-status-badge";

type Tab = "review" | "revisions" | "published" | "all";

const TABS: { key: Tab; label: string; view?: string }[] = [
  { key: "review", label: "Needs Review", view: "review" },
  { key: "revisions", label: "Revisions", view: "revisions" },
  { key: "published", label: "Published", view: "published" },
  { key: "all", label: "All Articles" },
];

const CHANNELS = [
  "All Channels",
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

function ArticlesContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get("view");
  const [tab, setTab] = useState<Tab>(
    initialView === "revisions"
      ? "revisions"
      : initialView === "published"
      ? "published"
      : initialView === "review"
      ? "review"
      : "all"
  );
  const [selectedChannel, setSelectedChannel] = useState("All Channels");
  const [articles, setArticles] = useState<ArticleRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadArticles = useCallback(async () => {
    try {
      const channelParam =
        selectedChannel !== "All Channels" ? `&channel=${encodeURIComponent(selectedChannel)}` : "";
      const res = await fetch(`/api/articles?t=${Date.now()}${channelParam}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load articles.");
      setArticles(data.articles as ArticleRow[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, [selectedChannel]);

  useEffect(() => {
    loadArticles();
    const interval = setInterval(loadArticles, 20000);
    return () => clearInterval(interval);
  }, [loadArticles]);

  const counts: Record<Tab, number> = {
    review: (articles ?? []).filter((a) => a.status === "review_ready").length,
    revisions: (articles ?? []).filter((a) => a.status === "revision_requested").length,
    published: (articles ?? []).filter((a) => a.status === "published").length,
    all: (articles ?? []).length,
  };

  const filteredList = (articles ?? []).filter((a) => {
    if (tab === "review") return a.status === "review_ready";
    if (tab === "revisions") return a.status === "revision_requested";
    if (tab === "published") return a.status === "published";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--color-purple)]" />
            Articles & Posts
          </h1>
          <p className="text-xs text-[var(--text-faint)] mt-1">
            Review, revise, and approve automated long-form articles, product comparisons, and SEO posts across all channels.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/pipeline/posts/topics"
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5"
          >
            <Sparkles className="w-4 h-4 text-[var(--color-purple)]" />
            Weekly Topics
          </Link>
        </div>
      </div>

      {/* Tabs & Channel Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "px-3.5 py-2 text-sm font-medium -mb-2 border-b-2 transition-colors",
                tab === t.key
                  ? "border-[var(--color-purple)] text-[var(--color-purple)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
              )}
            >
              {t.label} <span className="ml-1 text-xs opacity-70">({counts[t.key]})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-4 h-4 text-[var(--text-faint)]" />
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] py-1.5 px-2.5 focus:outline-none focus:border-[var(--color-purple)]"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-[var(--color-red)]">{error}</p>}

      {loading && !articles && (
        <p className="text-xs text-[var(--text-faint)] flex items-center gap-2 py-8 justify-center">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--color-purple)]" />
          Loading articles...
        </p>
      )}

      {articles && filteredList.length === 0 && (
        <div className="card p-12 text-center space-y-2">
          <FileText className="w-12 h-12 mx-auto text-[var(--border-strong)]" />
          <h3 className="text-sm font-semibold text-[var(--text)]">No articles in this view</h3>
          <p className="text-xs text-[var(--text-faint)] max-w-sm mx-auto">
            When the Cloud Antigravity Agent generates articles from agreed topics, they appear here for your review and approval.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filteredList.map((article) => {
          const productCount = (article.product_ids || []).length;
          const pendingNotes = (article.revision_history || []).filter(
            (r) => r.status === "pending"
          ).length;

          return (
            <Link
              key={article.id}
              href={`/pipeline/posts/${article.id}`}
              className="flex items-start sm:items-center gap-4 p-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-raised)] transition-all group"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-muted)]">
                    {article.channel}
                  </span>
                  {article.category && (
                    <span className="text-[11px] text-[var(--text-faint)]">
                      · {article.category}
                    </span>
                  )}
                  <ArticleStatusBadge status={article.status as ArticleStatus} size="sm" />
                  {pendingNotes > 0 && (
                    <span className="badge badge-amber text-[10px] flex items-center gap-1">
                      <MessageSquareWarning className="w-3 h-3" />
                      {pendingNotes} revision note{pendingNotes === 1 ? "" : "s"}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-semibold text-[var(--text)] group-hover:text-[var(--color-purple)] transition-colors leading-snug">
                  {article.title}
                </h3>

                <div className="flex items-center gap-3 text-xs text-[var(--text-faint)] flex-wrap">
                  {productCount > 0 && (
                    <span className="flex items-center gap-1 text-[var(--color-purple)] font-medium">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {productCount} product{productCount === 1 ? "" : "s"} discussed
                    </span>
                  )}
                  {productCount > 0 && <span>·</span>}
                  <span>Updated {formatTimeAgo(article.updated_at)}</span>
                  <span>·</span>
                  <span className="font-mono text-[10px] opacity-70">{article.id.slice(0, 8)}</span>
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-[var(--text-faint)] group-hover:text-[var(--text)] transition-colors flex-shrink-0 self-center" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-[var(--text-faint)]">Loading articles...</div>}>
      <ArticlesContent />
    </Suspense>
  );
}
