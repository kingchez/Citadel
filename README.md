# Citadel

Mission Control for the Viralnotely video pipeline — review, retry, and
approve videos moving through `Video Pipeline` and `Video Pipeline —
Retries` (both n8n workflows) without touching Supabase or n8n directly.

## What it does (v1 scope)

- Lists every video and its current pipeline status, filterable by
  needs-review / in-progress / errors / done.
- Per-video detail: every script segment, voice-timing clip, and media
  asset with its own real status and error (not just the overall video
  status).
- One-click **Retry** on any failed segment/clip/media code/render — this
  calls the Retries workflow's `POST /webhook/retry`, which just queues
  it; the retry cron dispatches it whenever the VPS is actually free.
- One-click **Approve** at each review checkpoint (`media_review`,
  `production_review`, `done` → `shipped`).

Everything talks to Supabase and n8n through Citadel's own API routes
(`src/app/api/*`) — the browser never holds Supabase credentials, unlike
the previous `vn-dashboard` approach.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — service role key, never
     the anon key (these API routes run server-side only).
   - `N8N_BASE_URL` — e.g. `https://n8n.viralnotely.com`
3. `npm run dev`

## Deploying

Built to run on Vercel — import this repo as a new project (Next.js is
auto-detected, no build config needed) and set the three environment
variables above in the Vercel dashboard. No VPS involved; this adds zero
load to the existing Dokploy infrastructure.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS. No client-side Supabase
SDK — reads/writes go through this app's own API routes, which use the
Supabase service role key server-side and call the two n8n workflows'
webhooks directly.
