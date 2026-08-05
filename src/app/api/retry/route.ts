import { NextRequest, NextResponse } from "next/server";
import { getN8nBaseUrl } from "@/lib/n8n";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { video_id, service, target } = body ?? {};

    if (!video_id || !service) {
      return NextResponse.json(
        { error: "Both video_id and service are required." },
        { status: 400 }
      );
    }

    let n8nBaseUrl: string;
    try {
      n8nBaseUrl = getN8nBaseUrl();
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }

    // This just enqueues into the retries table - the retry cron picks it up
    // whenever the VPS is actually free. Nothing dispatches synchronously
    // from this call.
    const res = await fetch(`${n8nBaseUrl}/webhook/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id, service, target: target ?? null }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Could not queue retry: ${text}` }, { status: 502 });
    }

    const queued = await res.json();
    return NextResponse.json({ retry: queued });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
