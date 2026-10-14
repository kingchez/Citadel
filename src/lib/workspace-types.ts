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
    needsReview: { id: string; title: string; status: string }[];
    activeJob: { id: string; title: string; service: string | null } | null;
  };
  news: {
    needsReview: number;
    paused: number;
    reviewed: number;
    urgent: { id: string; title: string; hours: number | null }[];
  };
}

/** Only internal paths and http(s) links are ever rendered as links. */
export function safeLink(link: string | null | undefined): { href: string; external: boolean } | null {
  if (!link) return null;
  if (link.startsWith("/")) return { href: link, external: false };
  if (/^https?:\/\//i.test(link)) return { href: link, external: true };
  return null;
}
