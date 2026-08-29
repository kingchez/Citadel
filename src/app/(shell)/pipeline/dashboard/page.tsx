import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { formatTimeAgo } from "@/lib/utils";
import { DONE_STATUSES, type VideoRow } from "@/lib/types";
import { computeVideoCounts, parseVpsService, hasAnyError } from "@/lib/video-stats";
import { Activity, ArrowRight, AlertTriangle, CheckCircle2, Clock, Zap, ChevronRight } from "lucide-react";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("videos")
    .select(
      "id, title, channel, status, video_type, with_product, created_at, updated_at, vps_in_use, vps_status, vps_current_service, error_details, script_segments, voice_timing, media_assets, revision_history"
    )
    .order("updated_at", { ascending: false });

  const videos = (data || []) as VideoRow[];
  const counts = computeVideoCounts(videos);

  // Recent Activity is simply the same video list this page already loaded,
  // sorted by most recently updated (the query above already orders that
  // way) - not a separate log or table of its own.
  const recentActivity = videos.slice(0, 6);
  const activeJob = videos.find((v) => v.vps_in_use);
  const vpsService = parseVpsService(activeJob?.vps_status);

  const doneWithTimestamps = videos.filter((v) => DONE_STATUSES.includes(v.status));
  const avgTurnaroundHours =
    doneWithTimestamps.length > 0
      ? doneWithTimestamps.reduce((sum, v) => {
          const ms = new Date(v.updated_at).getTime() - new Date(v.created_at).getTime();
          return sum + ms / 3600000;
        }, 0) / doneWithTimestamps.length
      : null;

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{getGreeting()}, Kingsley 👋</h1>
          <p className="mt-1 text-sm text-[var(--text-faint)]">{today}</p>
        </div>
        <Link
          href="/pipeline/videos"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-purple-soft)] text-[var(--color-purple)] hover:bg-[var(--color-purple)] hover:text-white transition-all duration-200 text-sm font-semibold border border-[var(--color-purple)]/30 hover:border-[var(--color-purple)]"
        >
          <span>Open Pipeline</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Videos" value={counts.total} icon="Film" color="purple" link="/pipeline/videos" />
        <StatCard title="Errors" value={counts.errors} icon="AlertTriangle" color="red" link="/pipeline/videos?view=errors" />
        <StatCard title="In Progress" value={counts.progress} icon="Clock" color="cyan" link="/pipeline/videos?view=progress" />
        <StatCard title="Needs Review" value={counts.review} icon="ClipboardCheck" color="amber" link="/pipeline/videos?view=review" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[var(--color-purple)]" />
            <h2 className="font-semibold text-[var(--text)]">Pipeline Health</h2>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-raised)] border border-[var(--border)]">
            <div className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0 inline-block"
                style={{
                  backgroundColor: vpsService ? vpsService.color : "var(--color-green)",
                  boxShadow: `0 0 6px ${vpsService ? vpsService.color : "var(--color-green-glow)"}`,
                }}
              />
              <div>
                <p className="text-sm font-semibold text-[var(--text)]">VPS</p>
                <p className="text-[11px] text-[var(--text-faint)]">{vpsService ? vpsService.label : "Idle"}</p>
              </div>
            </div>
            <span
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: vpsService ? vpsService.color : "var(--color-green)" }}
            >
              {vpsService ? "Busy" : "Idle"}
            </span>
          </div>

          <div className="divider" />
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-[var(--color-green-soft)] border border-[var(--color-green)]/20 text-center">
              <p className="text-xl font-bold text-[var(--color-green)]">{counts.done}</p>
              <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mt-0.5">Finished</p>
            </div>
            <div className="p-3 rounded-xl bg-[var(--color-cyan-soft)] border border-[var(--color-cyan)]/20 text-center">
              <p className="text-xl font-bold text-[var(--color-cyan)]">
                {avgTurnaroundHours !== null ? `${avgTurnaroundHours.toFixed(1)}h` : "—"}
              </p>
              <p className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider mt-0.5">Avg Turnaround</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[var(--color-amber)]" />
              <h2 className="font-semibold text-[var(--text)]">Recent Activity</h2>
            </div>
            <Link href="/pipeline/videos" className="text-sm text-[var(--color-purple)] hover:opacity-80 font-medium flex items-center gap-1">
              View all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-1">
            {recentActivity.length === 0 && <p className="text-sm text-[var(--text-faint)] py-4 text-center">No videos yet.</p>}
            {recentActivity.map((video) => {
              const isError = hasAnyError(video);
              const isDone = DONE_STATUSES.includes(video.status);
              return (
                <Link
                  key={video.id}
                  href={`/pipeline/videos/${video.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--surface-raised)] transition-colors group"
                >
                  <div className="flex-shrink-0">
                    {isError ? (
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-red-soft)] flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-[var(--color-red)]" />
                      </div>
                    ) : isDone ? (
                      <div className="w-8 h-8 rounded-lg bg-[var(--color-green-soft)] flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-green)]" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-[var(--surface-raised)] flex items-center justify-center">
                        <Clock className="w-4 h-4 text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--text)] truncate group-hover:opacity-90 transition-colors">
                      {video.title}
                    </p>
                    <p className="text-[11px] text-[var(--text-faint)]">
                      {video.channel} · {formatTimeAgo(video.updated_at)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <StatusBadge status={video.status} size="sm" showIcon={false} />
                    <ChevronRight className="w-4 h-4 text-[var(--border-strong)] group-hover:text-[var(--color-purple)] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
