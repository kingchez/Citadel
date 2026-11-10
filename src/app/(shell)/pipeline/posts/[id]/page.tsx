"use client";

import { use, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  MessageSquareWarning,
  Loader2,
  FileText,
  ShoppingCart,
  Image as ImageIcon,
  Share2,
  History,
  Copy,
  ExternalLink,
  Code,
  Sparkles,
  Eye,
  Check,
  AlertTriangle,
} from "lucide-react";
import { cn, formatTimeAgo } from "@/lib/utils";
import type { ArticleRow, ArticleStatus } from "@/lib/article-types";
import { ArticleStatusBadge } from "@/components/article-status-badge";

interface ArticleDetailPageProps {
  params: Promise<{ id: string }>;
}

type Tab = "article" | "products" | "thumbnail_seo" | "social" | "revisions";

export default function ArticleDetailPage({ params }: ArticleDetailPageProps) {
  const { id } = use(params);
  const [article, setArticle] = useState<ArticleRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("article");
  const [showRawHtml, setShowRawHtml] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadArticle = useCallback(async () => {
    try {
      const res = await fetch(`/api/articles/${id}?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Article not found");
      setArticle(data.article as ArticleRow);
    } catch {
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadArticle();
  }, [loadArticle]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleApprove = async () => {
    if (!article) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      showToast("Article Approved!");
      loadArticle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitRevision = async () => {
    if (!article || !revisionNote.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/articles/${article.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: revisionNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit revision");
      showToast("Revision feedback submitted! Status dropped to Revision Requested.");
      setRevisionNote("");
      setShowRevisionModal(false);
      loadArticle();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-xs text-[var(--text-faint)] flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--color-purple)]" />
        Loading article details...
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center space-y-3">
        <p className="text-sm text-[var(--text-muted)]">Article not found.</p>
        <Link href="/pipeline/posts" className="text-xs text-[var(--color-purple)] hover:underline">
          Back to Articles
        </Link>
      </div>
    );
  }

  const wordCount = (article.body_html || "")
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  const readTimeMins = Math.max(1, Math.ceil(wordCount / 220));
  const products = article.product_ids || [];
  const revisionHistory = article.revision_history || [];
  const pendingRevisions = revisionHistory.filter((r) => r.status === "pending");

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Breadcrumb & Navigation */}
      <Link
        href="/pipeline/posts"
        className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Articles & Posts
      </Link>

      {/* Header Card */}
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="badge badge-purple text-xs font-semibold">{article.channel}</span>
              {article.category && (
                <span className="text-xs text-[var(--text-muted)]">· {article.category}</span>
              )}
              <ArticleStatusBadge status={article.status as ArticleStatus} size="md" />
              <button
                onClick={() => copyToClipboard(article.id, "uuid")}
                className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
                title="Copy database ID"
              >
                {article.id}
              </button>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] leading-snug">
              {article.title}
            </h1>

            <div className="flex items-center gap-3 text-xs text-[var(--text-faint)] flex-wrap">
              <span>{wordCount} words (~{readTimeMins} min read)</span>
              <span>·</span>
              <span>Slug: <code className="text-[var(--text-muted)]">/{article.slug}</code></span>
              <span>·</span>
              <span>Updated {formatTimeAgo(article.updated_at)}</span>
            </div>
          </div>

          {/* Action Header */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={() => setShowRevisionModal(true)}
              disabled={actionLoading}
              className="btn-amber text-xs flex items-center gap-1.5 py-2 px-3.5"
            >
              <MessageSquareWarning className="w-4 h-4" />
              Request Revision
            </button>

            <button
              onClick={handleApprove}
              disabled={actionLoading || article.status === "approved" || article.status === "published"}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-green)] text-white hover:opacity-90 transition-opacity text-xs font-semibold disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              {article.status === "approved" || article.status === "published"
                ? "Approved"
                : "Approve & Schedule"}
            </button>
          </div>
        </div>

        {/* Revision Alert Banner */}
        {pendingRevisions.length > 0 && (
          <div className="p-4 rounded-xl bg-[var(--color-amber-soft)]/50 border border-[var(--color-amber)]/40 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-amber)]">
              <AlertTriangle className="w-4 h-4" />
              <span>{pendingRevisions.length} Revision Request(s) Pending Cloud Agent Attention</span>
            </div>
            <div className="space-y-1.5 pl-6">
              {pendingRevisions.map((rev) => (
                <div key={rev.id} className="text-xs text-[var(--text)]">
                  • {rev.note} <span className="text-[10px] text-[var(--text-faint)]">({formatTimeAgo(rev.created_at)})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-xl w-fit max-w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab("article")}
          className={cn("tab flex items-center gap-2", activeTab === "article" && "tab-active")}
        >
          <FileText className="w-4 h-4" />
          Article Content
        </button>

        <button
          onClick={() => setActiveTab("products")}
          className={cn("tab flex items-center gap-2", activeTab === "products" && "tab-active")}
        >
          <ShoppingCart className="w-4 h-4" />
          Affiliate Products
          {products.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--border)] font-bold">
              {products.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("thumbnail_seo")}
          className={cn("tab flex items-center gap-2", activeTab === "thumbnail_seo" && "tab-active")}
        >
          <ImageIcon className="w-4 h-4" />
          Thumbnail & SEO
        </button>

        <button
          onClick={() => setActiveTab("social")}
          className={cn("tab flex items-center gap-2", activeTab === "social" && "tab-active")}
        >
          <Share2 className="w-4 h-4" />
          Social Copy
        </button>

        <button
          onClick={() => setActiveTab("revisions")}
          className={cn("tab flex items-center gap-2", activeTab === "revisions" && "tab-active")}
        >
          <History className="w-4 h-4" />
          Revisions
          {revisionHistory.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--border)] font-bold">
              {revisionHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab: Article Content */}
      {activeTab === "article" && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--color-purple)]" />
              Formatted Article Reader
            </h2>
            <button
              onClick={() => setShowRawHtml(!showRawHtml)}
              className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5"
            >
              <Code className="w-3.5 h-3.5" />
              {showRawHtml ? "Show Formatted Preview" : "View Raw HTML"}
            </button>
          </div>

          {showRawHtml ? (
            <pre className="p-4 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] font-mono text-xs text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap max-h-[700px]">
              {article.body_html}
            </pre>
          ) : (
            <div
              className="prose dark:prose-invert max-w-none text-sm text-[var(--text)] leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: article.body_html }}
            />
          )}
        </div>
      )}

      {/* Tab: Affiliate Products */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {products.length === 0 ? (
            <div className="card p-12 text-center text-xs text-[var(--text-faint)]">
              No products attached to this article.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((prod, idx) => (
                <div
                  key={prod.asin || idx}
                  className="card p-4 space-y-2.5 border border-[var(--border)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[var(--color-purple)] px-2 py-0.5 rounded bg-[var(--color-purple-soft)]">
                      ASIN: {prod.asin}
                    </span>
                    {prod.price && (
                      <span className="text-xs font-bold text-[var(--color-green)]">
                        {prod.price}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-[var(--text)] line-clamp-2">
                    {prod.title}
                  </h3>

                  <div className="flex items-center gap-3 text-xs text-[var(--text-faint)]">
                    {prod.rating && <span>⭐ {prod.rating} / 5</span>}
                    {prod.review_count && <span>({prod.review_count.toLocaleString()} reviews)</span>}
                  </div>

                  {prod.url && (
                    <div className="pt-2 border-t border-[var(--border)]">
                      <a
                        href={prod.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-purple)] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View on Amazon
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Thumbnail & SEO */}
      {activeTab === "thumbnail_seo" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Thumbnail Card */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[var(--color-purple)]" />
              Featured Thumbnail (Google Drive)
            </h2>

            {article.thumbnail_drive_file_id ? (
              <div className="space-y-3">
                <div className="aspect-[1200/630] rounded-xl overflow-hidden bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center relative">
                  <iframe
                    src={`https://drive.google.com/file/d/${article.thumbnail_drive_file_id}/preview`}
                    className="w-full h-full border-0"
                    title="Thumbnail Preview"
                  />
                </div>
                <div className="space-y-1 text-xs text-[var(--text-faint)]">
                  <p>
                    <strong className="text-[var(--text-muted)]">File Name:</strong>{" "}
                    <code>{article.id}.png</code>
                  </p>
                  <p>
                    <strong className="text-[var(--text-muted)]">Drive File ID:</strong>{" "}
                    <code>{article.thumbnail_drive_file_id}</code>
                  </p>
                  <p>
                    <strong className="text-[var(--text-muted)]">WP Media ID:</strong>{" "}
                    {article.wordpress_media_id ? (
                      <span className="text-[var(--color-green)] font-semibold">
                        Uploaded (#{article.wordpress_media_id})
                      </span>
                    ) : (
                      <span>Pending publishing</span>
                    )}
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-[1200/630] rounded-xl bg-[var(--surface-raised)] border border-[var(--border)] flex flex-col items-center justify-center p-6 text-center text-xs text-[var(--text-faint)]">
                <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                Thumbnail will be uploaded by the Cloud Agent under <code>{article.id}.png</code>
              </div>
            )}
          </div>

          {/* SEO Metadata Card */}
          <div className="card p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--color-purple)]" />
              SEO & Schema Metadata
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-[var(--text-muted)]">Focus Keyword:</span>
                <p className="mt-1 text-sm font-medium text-[var(--text)]">
                  {article.seo_metadata?.focus_keyword || "None set"}
                </p>
              </div>

              <div>
                <span className="font-semibold text-[var(--text-muted)]">Meta Description:</span>
                <p className="mt-1 text-xs text-[var(--text)] bg-[var(--surface-raised)] p-3 rounded-lg border border-[var(--border)]">
                  {article.seo_metadata?.meta_description || "None set"}
                </p>
              </div>

              {article.seo_metadata?.secondary_keywords && (
                <div>
                  <span className="font-semibold text-[var(--text-muted)]">Secondary Keywords:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {article.seo_metadata.secondary_keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-[var(--surface-raised)] border border-[var(--border)] text-[11px]"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {article.seo_metadata?.schema_json && (
                <div>
                  <span className="font-semibold text-[var(--text-muted)]">Schema.org JSON-LD:</span>
                  <pre className="mt-1.5 p-3 rounded-lg bg-[var(--surface-raised)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-muted)] max-h-48 overflow-y-auto">
                    {JSON.stringify(article.seo_metadata.schema_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Social Copy */}
      {activeTab === "social" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* X Post */}
          <div className="card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">X (Twitter) Snippet</span>
              <button
                onClick={() => copyToClipboard(article.social_metadata?.x_post || "", "x")}
                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
              >
                {copiedKey === "x" ? <Check className="w-3 h-3 text-[var(--color-green)]" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap bg-[var(--surface-raised)] p-3 rounded-lg border border-[var(--border)]">
              {article.social_metadata?.x_post || "No X post copy generated yet."}
            </p>
          </div>

          {/* Threads Post */}
          <div className="card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">Threads Snippet</span>
              <button
                onClick={() => copyToClipboard(article.social_metadata?.threads_post || "", "threads")}
                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
              >
                {copiedKey === "threads" ? <Check className="w-3 h-3 text-[var(--color-green)]" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap bg-[var(--surface-raised)] p-3 rounded-lg border border-[var(--border)]">
              {article.social_metadata?.threads_post || "No Threads post copy generated yet."}
            </p>
          </div>

          {/* Pinterest Pin */}
          <div className="card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">Pinterest Pin</span>
              <button
                onClick={() =>
                  copyToClipboard(
                    `${article.social_metadata?.pinterest_pin?.title || ""}\n\n${
                      article.social_metadata?.pinterest_pin?.description || ""
                    }`,
                    "pin"
                  )
                }
                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
              >
                {copiedKey === "pin" ? <Check className="w-3 h-3 text-[var(--color-green)]" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <div className="text-xs text-[var(--text-muted)] space-y-1.5 bg-[var(--surface-raised)] p-3 rounded-lg border border-[var(--border)]">
              <p>
                <strong className="text-[var(--text)]">Title:</strong>{" "}
                {article.social_metadata?.pinterest_pin?.title || "None"}
              </p>
              <p>
                <strong className="text-[var(--text)]">Description:</strong>{" "}
                {article.social_metadata?.pinterest_pin?.description || "None"}
              </p>
            </div>
          </div>

          {/* Facebook Post */}
          <div className="card p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text)]">Facebook Post</span>
              <button
                onClick={() => copyToClipboard(article.social_metadata?.facebook_post || "", "fb")}
                className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1"
              >
                {copiedKey === "fb" ? <Check className="w-3 h-3 text-[var(--color-green)]" /> : <Copy className="w-3 h-3" />}
                Copy
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] whitespace-pre-wrap bg-[var(--surface-raised)] p-3 rounded-lg border border-[var(--border)]">
              {article.social_metadata?.facebook_post || "No Facebook post copy generated yet."}
            </p>
          </div>
        </div>
      )}

      {/* Tab: Revisions */}
      {activeTab === "revisions" && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
            <History className="w-4 h-4 text-[var(--color-purple)]" />
            Revision Feedback History
          </h2>

          {revisionHistory.length === 0 ? (
            <p className="text-xs text-[var(--text-faint)]">No revisions requested yet.</p>
          ) : (
            <div className="space-y-2.5">
              {revisionHistory
                .slice()
                .reverse()
                .map((rev) => (
                  <div
                    key={rev.id}
                    className={cn(
                      "p-3 rounded-xl border text-xs space-y-1",
                      rev.status === "pending"
                        ? "bg-[var(--color-amber-soft)]/40 border-[var(--color-amber)]/40"
                        : "bg-[var(--surface-raised)] border-[var(--border)]"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "badge text-[10px]",
                          rev.status === "pending" ? "badge-amber" : "badge-green"
                        )}
                      >
                        {rev.status === "pending" ? "Pending Agent" : "Resolved"}
                      </span>
                      <span className="text-[10px] text-[var(--text-faint)]">
                        {formatTimeAgo(rev.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text)] mt-1">{rev.note}</p>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6 space-y-4 animate-scale-up">
            <h3 className="text-base font-bold text-[var(--text)] flex items-center gap-2">
              <MessageSquareWarning className="w-5 h-5 text-[var(--color-amber)]" />
              Request Revision for Cloud Agent
            </h3>
            <p className="text-xs text-[var(--text-faint)] leading-relaxed">
              Describe what changes are needed (e.g., &quot;Regenerate thumbnail with darker background&quot;, &quot;Add more specs on product #2&quot;, &quot;Make the introduction punchier&quot;).
              Submitting drops the status to <strong>Revision Requested</strong> until the agent completes your instructions.
            </p>

            <textarea
              rows={4}
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="Enter revision instructions for the agent..."
              className="w-full bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--color-purple)]"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                className="btn-secondary text-xs py-2 px-3.5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitRevision}
                disabled={actionLoading || !revisionNote.trim()}
                className="btn-amber text-xs py-2 px-4 disabled:opacity-50"
              >
                {actionLoading ? "Submitting..." : "Submit Revision"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {feedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[var(--color-purple-soft)] border border-[var(--color-purple)] text-xs font-semibold text-[var(--text)] shadow-xl animate-slide-down">
          <Sparkles className="w-4 h-4 text-[var(--color-purple)]" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
