import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeVideoCounts, hasAnyError, needsReview as videoNeedsReview } from "@/lib/video-stats";
import { deriveNotifications } from "@/lib/notifications";
import { DONE_STATUSES, type VideoRow } from "@/lib/types";
import type { WorkspaceSummary } from "@/lib/workspace-types";

export const dynamic = "force-dynamic";

/** One call that feeds the whole Workspace dashboard. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const horizon = new Date(now.getTime() + 8 * 24 * 3600 * 1000);

    const [alertsRes, doneRes, scheduleRes, videosRes, eventsRes, trendsRes, articlesRes] = await Promise.all([
      supabase.from("workspace_notifications").select("*").eq("status", "open").order("last_seen_at", { ascending: false }).limit(60),
      // done today = anything ticked off / acknowledged today (duties, meetings and to-dos alike)
      supabase.from("citadel_schedule_items").select("id", { count: "exact", head: true }).eq("status", "done").gte("acknowledged_at", startOfToday.toISOString()),
      supabase
        .from("citadel_schedule_items")
        .select("*")
        .eq("status", "upcoming")
        .eq("active", true)
        // next 8 days + anything overdue + anytime to-dos (next_at is null)
        .or(`next_at.lte.${horizon.toISOString()},next_at.is.null`)
        .order("next_at", { ascending: true, nullsFirst: false })
        .limit(100),
      supabase
        .from("videos")
        .select("id, title, channel, status, vps_in_use, vps_current_service, error_details, script_segments, voice_timing, media_assets, revision_history, created_at, updated_at"),
      supabase
        .from("events")
        .select("id, event_title, social_headline, status, golden_window_hours, global_relevance_score, video_id, created_at")
        .neq("status", "pending"),
      supabase
        .from("Trend_Processing")
        .select("id, trending_keyword, country, traffic, created_at, events:events_id(id, event_title, global_relevance_score)")
        .eq("status", "needs_review")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("articles")
        .select("id, title, channel, category, status, media_instructions, created_at, updated_at")
        .neq("status", "archived")
        .order("updated_at", { ascending: false }),
    ]);

    const firstError = [alertsRes, scheduleRes, videosRes, eventsRes].find((r) => r.error)?.error;
    if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 });

    const videos = (videosRes.data || []) as unknown as VideoRow[];
    const counts = computeVideoCounts(videos);
    const liveIssues = deriveNotifications(videos).length;
    const active = videos.find((v) => v.vps_in_use);

    // average hours from created to last update across finished videos
    const finished = videos.filter((v) => DONE_STATUSES.includes(v.status));
    const avgTurnaroundHours =
      finished.length > 0
        ? finished.reduce((sum, v) => sum + (new Date(v.updated_at).getTime() - new Date(v.created_at).getTime()) / 3600000, 0) / finished.length
        : null;

    const sortedVideos = [...videos].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const recent = sortedVideos
      .slice(0, 6)
      .map((v) => ({ id: v.id, title: v.title, channel: v.channel ?? "", status: v.status, updated_at: v.updated_at, hasError: hasAnyError(v) }));

    const videoNeedsReviewItems = sortedVideos
      .filter((v) => videoNeedsReview(v))
      .slice(0, 8)
      .map((v) => ({
        id: v.id,
        title: v.title,
        channel: v.channel ?? "",
        status: v.status,
        updated_at: v.updated_at,
      }));

    const videoErrorItems = sortedVideos
      .filter((v) => hasAnyError(v) || v.status === "revision_requested")
      .slice(0, 8)
      .map((v) => {
        const rawErr: unknown = v.error_details;
        let errMsg: string | null = null;
        if (typeof rawErr === "string" && rawErr.trim()) {
          errMsg = rawErr.trim();
        } else if (rawErr && typeof rawErr === "object") {
          const errObj = rawErr as Record<string, unknown>;
          if (typeof errObj.message === "string") errMsg = errObj.message;
          else if (typeof errObj.error === "string") errMsg = errObj.error;
        }
        return {
          id: v.id,
          title: v.title,
          channel: v.channel ?? "",
          status: v.status,
          updated_at: v.updated_at,
          errorSummary: errMsg,
        };
      });

    const events = (eventsRes.data || []) as {
      id: string;
      event_title: string | null;
      social_headline: string | null;
      status: string;
      golden_window_hours: number | null;
      global_relevance_score: number | null;
      video_id: string | null;
      created_at: string;
    }[];
    const unreviewedEvents = events
      .filter((e) => e.status === "unprocessed" || e.status === "processing")
      .sort((a, b) => {
        const aWin = a.golden_window_hours ?? 9999;
        const bWin = b.golden_window_hours ?? 9999;
        if (aWin !== bWin) return aWin - bWin;
        return (b.global_relevance_score ?? 0) - (a.global_relevance_score ?? 0);
      });

    const rawTrends = (trendsRes.data || []) as unknown as {
      id: number;
      trending_keyword: string | null;
      country: string | null;
      traffic: string | null;
      created_at: string;
      events: { id?: string; event_title?: string | null; global_relevance_score?: number | null } | { id?: string; event_title?: string | null; global_relevance_score?: number | null }[] | null;
    }[];

    const trendReviewItems = rawTrends.map((t) => {
      const ev = Array.isArray(t.events) ? t.events[0] : t.events;
      return {
        id: t.id,
        keyword: t.trending_keyword || `Trend #${t.id}`,
        eventTitle: ev?.event_title ?? null,
        country: t.country ?? null,
        traffic: t.traffic ?? null,
        relevance: ev?.global_relevance_score ?? null,
        created_at: t.created_at,
      };
    });

    const rawArticles = (articlesRes.data || []) as {
      id: string;
      title: string | null;
      channel: string | null;
      category: string | null;
      status: string;
      media_instructions: { uploaded?: boolean }[] | null;
      created_at: string;
      updated_at: string;
    }[];

    const countPendingMedia = (a: (typeof rawArticles)[number]) =>
      Array.isArray(a.media_instructions) ? a.media_instructions.filter((m) => !m.uploaded).length : 0;

    const articleReviewItems = rawArticles
      .filter((a) => a.status === "review_ready")
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title || "Untitled Article",
        channel: a.channel,
        category: a.category,
        status: a.status,
        mediaPendingCount: countPendingMedia(a),
        updated_at: a.updated_at || a.created_at,
      }));

    const articleRevisionAndDraftItems = rawArticles
      .filter((a) => a.status === "revision_requested" || a.status === "researching" || a.status === "planning" || countPendingMedia(a) > 0)
      .filter((a) => a.status !== "published" && a.status !== "review_ready")
      .slice(0, 8)
      .map((a) => ({
        id: a.id,
        title: a.title || "Untitled Article",
        channel: a.channel,
        category: a.category,
        status: a.status,
        mediaPendingCount: countPendingMedia(a),
        updated_at: a.updated_at || a.created_at,
      }));

    const mediaPendingTotal = rawArticles.reduce((acc, a) => acc + countPendingMedia(a), 0);

    const summary: WorkspaceSummary = {
      now: now.toISOString(),
      alerts: (alertsRes.data || []) as WorkspaceSummary["alerts"],
      doneToday: doneRes.count ?? 0,
      schedule: (scheduleRes.data || []) as WorkspaceSummary["schedule"],
      videos: {
        total: counts.total,
        errors: counts.errors,
        progress: counts.progress,
        review: counts.review,
        done: counts.done,
        liveIssues,
        needsReview: videoNeedsReviewItems,
        errorItems: videoErrorItems,
        avgTurnaroundHours,
        recent,
        activeJob: active ? { id: active.id, title: active.title, service: active.vps_current_service ?? null } : null,
      },
      news: {
        trendReviewCount: trendReviewItems.length,
        needsReview: unreviewedEvents.length,
        paused: events.filter((e) => e.status === "paused").length,
        reviewed: events.filter((e) => e.status === "reviewed").length,
        converted: events.filter((e) => !!e.video_id).length,
        trendReviewItems: trendReviewItems.slice(0, 8),
        eventsNeedsReviewItems: unreviewedEvents.slice(0, 8).map((e) => ({
          id: e.id,
          title: e.social_headline || e.event_title || `Event #${e.id}`,
          status: e.status,
          hours: e.golden_window_hours,
          relevance: e.global_relevance_score,
          created_at: e.created_at,
        })),
        recentlyReviewed: events
          .filter((e) => e.status === "reviewed")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
          .map((e) => ({ id: e.id, title: e.social_headline || e.event_title || `Event #${e.id}`, toVideo: !!e.video_id, created_at: e.created_at })),
        urgent: unreviewedEvents
          .filter((e) => e.golden_window_hours != null)
          .slice(0, 5)
          .map((e) => ({ id: e.id, title: e.social_headline || e.event_title || "Untitled event", hours: e.golden_window_hours })),
      },
      articles: {
        total: rawArticles.length,
        reviewReady: rawArticles.filter((a) => a.status === "review_ready").length,
        revisionRequested: rawArticles.filter((a) => a.status === "revision_requested").length,
        inProgress: rawArticles.filter((a) => a.status === "planning" || a.status === "researching" || a.status === "publishing").length,
        published: rawArticles.filter((a) => a.status === "published" || a.status === "approved").length,
        mediaPendingTotal,
        reviewItems: articleReviewItems,
        revisionAndDraftItems: articleRevisionAndDraftItems,
      },
    };

    return NextResponse.json(summary);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
