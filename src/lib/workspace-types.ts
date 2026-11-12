export type AlertSeverity = "error" | "warning" | "action" | "info";

export interface WorkspaceAlert {
  id: string;
  dedupe_key: string;
  source: string;
  source_ref: string | null;
  severity: AlertSeverity;
  title: string;
  details: string | null;
  link_url: string | null;
  status: "open" | "resolved";
  occurrences: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface WorkspaceSummary {
  now: string;
  alerts: WorkspaceAlert[];
  doneToday: number;
  schedule: import("./schedule-types").ScheduleItem[];
  videos: {
    total: number;
    errors: number;
    progress: number;
    review: number;
    done: number;
    liveIssues: number;
    needsReview: { id: string; title: string; channel: string; status: string; updated_at: string }[];
    errorItems: { id: string; title: string; channel: string; status: string; updated_at: string; errorSummary: string | null }[];
    avgTurnaroundHours: number | null;
    recent: { id: string; title: string; channel: string; status: string; updated_at: string; hasError: boolean }[];
    activeJob: { id: string; title: string; service: string | null } | null;
  };
  news: {
    trendReviewCount: number;
    needsReview: number;
    paused: number;
    reviewed: number;
    converted: number;
    trendReviewItems: {
      id: number;
      keyword: string;
      eventTitle: string | null;
      country: string | null;
      traffic: string | null;
      relevance: number | null;
      created_at: string;
    }[];
    eventsNeedsReviewItems: {
      id: string;
      title: string;
      status: string;
      hours: number | null;
      relevance: number | null;
      created_at: string;
    }[];
    recentlyReviewed: { id: string; title: string; toVideo: boolean; created_at: string }[];
    urgent: { id: string; title: string; hours: number | null }[];
  };
  articles: {
    total: number;
    reviewReady: number;
    revisionRequested: number;
    inProgress: number;
    published: number;
    mediaPendingTotal: number;
    reviewItems: {
      id: string;
      title: string;
      channel: string | null;
      category: string | null;
      status: string;
      mediaPendingCount: number;
      updated_at: string;
    }[];
    revisionAndDraftItems: {
      id: string;
      title: string;
      channel: string | null;
      category: string | null;
      status: string;
      mediaPendingCount: number;
      updated_at: string;
    }[];
  };
}

/** Only internal paths and http(s) links are ever rendered as links. */
export function safeLink(link: string | null | undefined): { href: string; external: boolean } | null {
  if (!link) return null;
  if (link.startsWith("/")) return { href: link, external: false };
  if (/^https?:\/\//i.test(link)) return { href: link, external: true };
  return null;
}
