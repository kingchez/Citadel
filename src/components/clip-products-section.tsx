"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clapperboard, Loader2, X } from "lucide-react";
import { sourceStage, type RepurposeSource } from "@/lib/repurpose-sources";

interface Job {
  id: string;
  status: string;
  products_step: string | null;
  sources: RepurposeSource[];
  error_details: string | null;
}

/** On a video that is not repurposed: cut a clip for each product out of a video King provides. */
export function ClipProductsSection({ videoId }: { videoId: string }) {
  const [eligible, setEligible] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/videos/${videoId}/clip-job`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load.");
      setEligible(!!data.eligible);
      setJob(data.job ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load.");
    }
  }, [videoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const running = !!job;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 10000);
    return () => clearInterval(t);
  }, [running, load]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/clip-job`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urls }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start the clip job.");
      setUrls("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the clip job.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/videos/${videoId}/clip-job`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
    } finally {
      setBusy(false);
    }
  };

  if (!eligible) return null;

  const ready = job && (job.status === "voice_timing_done" || job.status === "handed_off");

  return (
    <div className="card p-5 mt-4 space-y-3">
      <h3 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2"><Clapperboard className="w-4 h-4" /> Clip products</h3>

      {!job && (
        <>
          <p className="text-xs text-[var(--text-faint)]">
            Want a video clip for each product on this video? Add the video(s) the clips should be cut from (one link per line). The video is downloaded,
            its voice is read to find where each product appears, you confirm on the Product Clips page, and the clips are cut. The downloaded files are
            deleted automatically once the clips are done; the clips stay.
          </p>
          <textarea
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
            rows={3}
            placeholder="https://www.youtube.com/watch?v=…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text)]"
          />
          <button type="button" disabled={busy || !urls.trim()} onClick={() => void start()} className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Start clip job
          </button>
        </>
      )}

      {job && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--text-muted)]">
            {ready
              ? job.products_step === "confirmed"
                ? "Products confirmed - the clips are being cut."
                : "Ready: check the products and where each one starts and ends."
              : "Getting the video ready (download, split, voice timing)…"}
          </p>
          <ul className="text-xs text-[var(--text-faint)] space-y-0.5">
            {job.sources.map((s) => {
              const st = sourceStage(s);
              return <li key={s.index}>Video {s.index + 1}: {st.label}{st.detail ? ` - ${st.detail}` : ""}</li>;
            })}
          </ul>
          {job.error_details && <p className="text-xs text-[var(--color-red)] break-words">{job.error_details}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {ready && (
              <Link href={`/pipeline/products/${job.id}`} className="btn-primary text-xs">Open Product Clips</Link>
            )}
            <Link href="/pipeline/repurpose" className="text-xs text-[var(--text-muted)] hover:underline">See it in the Repurpose queue (retry if a step failed)</Link>
            <button type="button" disabled={busy} onClick={() => void cancel()} className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--color-red)] disabled:opacity-50">
              <X className="w-3.5 h-3.5" /> Cancel clip job
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[var(--color-red)] break-words">{error}</p>}
    </div>
  );
}
