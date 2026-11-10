"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  FileText,
  Search,
  ChevronRight,
  Filter,
  ShoppingCart,
  MessageSquareWarning,
  Sparkles,
  Layers,
} from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ArticleRow, ArticleStatus } from "@/lib/article-types";
import { ArticleStatusBadge } from "@/components/article-status-badge";

const TABS = [
  { key: "all", label: "All Articles" },
  { key: "review", label: "Needs Review" },
  { key: "revisions", label: "Revisions" },
  { key: "published", label: "Published" },
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

function matchesArticleView(article: ArticleRow, view: string): boolean {
  switch (view) {
    case "review":
      return article.status === "review_ready";
    case "revisions":
      return article.status === "revision_requested";
    case "published":
      return article.status === "published";
    default:
      return true;
  }
}

function ArticleRowItem({ article }: { article: ArticleRow }) {
  const productCount = (article.product_ids || []).length;
  const pendingNotes = (article.revision_history || []).filter(
    (r) => r.status === "pending"
  ).length;

  return (
    <Link
      href={`/pipeline/posts/${article.id}`}
      className="group flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-4 sm:px-5 py-3.5 sm:py-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)] transition-all duration-150"
    >
      <div className="flex-1 min-w-[calc(100%-2.25rem)] sm:min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-semibold text-[var(--text)] line-clamp-2 sm:truncate group-hover:text-[var(--color-purple)] transition-colors">
            {article.title}
          </h3>
          {pendingNotes > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-red-soft)] text-[var(--color-red)] border border-[var(--color-red)]/30 flex-shrink-0">
              <MessageSquareWarning className="w-3 h-3" />
              {pendingNotes} revision note{pendingNotes > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--text-faint)] mt-1 flex items-center gap-1.5 flex-wrap">
          <span className="font-medium text-[var(--text-muted)]">{article.channel}</span>
          {article.category && (
            <>
              <span>·</span>
              <span>{article.category}</span>
            </>
          )}
          {productCount > 0 && (
            <>
              <span>·</span>
              <span className="text-[var(--color-purple)] inline-flex items-center gap-1 font-medium">
                <ShoppingCart className="w-3 h-3 inline" />
                {productCount} product{productCount > 1 ? "s" : ""}
              </span>
            </>
          )}
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)]">
            {article.id.slice(0, 8)}
          </span>
        </p>
      </div>

      <div className="flex-shrink-0">
        <ArticleStatusBadge status={article.status as ArticleStatus} size="sm" />
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 max-sm:ml-auto">
        <span className="text-xs text-[var(--text-faint)]">{formatTimeAgo(article.updated_at)}</span>
        <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors" />
      </div>
    </Link>
  );
}

function ArticlesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeTab = searchParams.get("view") || "all";
  const [search, setSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("All Channels");
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [loading, setLoading] = useState(true);

  const setActiveTab = (tab: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "all") params.delete("view");
    else params.set("view", tab);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    fetch(`/api/articles?t=${Date.now()}`)
      .then((r) => r.json())
      .then((data: { articles?: ArticleRow[] }) => setArticles(data.articles || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = articles.filter((a) => matchesArticleView(a, activeTab));
    if (selectedChannel !== "All Channels") {
      list = list.filter((a) => a.channel === selectedChannel);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.channel.toLowerCase().includes(q) ||
          (a.category && a.category.toLowerCase().includes(q)) ||
          a.status.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }
    return list;
  }, [articles, activeTab, selectedChannel, search]);

  const tabCounts = useMemo(
    () => ({
      all: articles.length,
      review: articles.filter((a) => a.status === "review_ready").length,
      revisions: articles.filter((a) => a.status === "revision_requested").length,
      published: articles.filter((a) => a.status === "published").length,
    }),
    [articles]
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[var(--color-purple)]" />
            Articles & Posts
          </h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">
            {articles.length} total articles across all 12 channels
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
        <div className="flex items-center gap-1 p-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit max-w-full overflow-x-auto">
          {TABS.map((tab) => {
            const count = tabCounts[tab.key as keyof typeof tabCounts];
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "tab flex items-center gap-2 text-xs",
                  activeTab === tab.key && "tab-active"
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    activeTab === tab.key
                      ? "bg-white/20 text-white"
                      : "bg-[var(--border)] text-[var(--text-faint)]"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-[var(--text-faint)]" />
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

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search articles by title, channel, category, status, or database ID..."
          className="input-field pl-11 py-3 text-xs"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-faint)] hover:text-[var(--text)] text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Article Rows List */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton h-[76px] rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-[var(--text-faint)]">
            <Layers className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-base font-medium">No articles found</p>
            <p className="text-xs mt-1 opacity-60">
              {search
                ? "Try adjusting your search query or channel filter"
                : "This category currently has no articles"}
            </p>
          </div>
        ) : (
          filtered.map((article) => <ArticleRowItem key={article.id} article={article} />)
        )}
      </div>
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6 text-[var(--text-faint)]">Loading...</div>}>
      <ArticlesContent />
    </Suspense>
  );
}
