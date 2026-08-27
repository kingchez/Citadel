# Citadel

Workshop command center. Video Pipeline is the first module — review,
retry, redo, and approve videos moving through `Video Pipeline` and
`Video Pipeline — Retries` (both n8n workflows) without touching Supabase
or n8n directly. Built so more projects can slot into the same shell later
(Workspace → Projects → each project owns its own dashboard + sub-nav).

## What it does

- **Auth**: single shared password, no email/username, long-lived cookie
  session (`middleware.ts` guards every route except `/login`).
- **Dashboard** (`/pipeline/dashboard`): live stat cards, VPS busy/idle,
  average turnaround, recent activity — all computed from real Supabase
  data, nothing fabricated.
- **Video Pipeline** (`/pipeline/videos`): every video, filterable by
  errors / in-progress / needs-review / done, search by title/channel/status.
- **Video detail**: every script segment with its own real status/error,
  audio playback right in the browser (proxied from Google Drive so it
  streams instead of opening a new tab), single-segment retry (queues a row
  directly into the `retries` table — the dispatch cron in n8n picks it up),
  and multi-select redo — selecting some-or-all segments and clicking Redo
  writes directly to `videos.active_retry`, which the **Citadel Manual
  Redo** dispatch lane in the Retries workflow watches and acts on. Neither
  of these goes through an n8n webhook: Citadel writes the database change
  itself, and n8n's job starts at "notice this state and do something about
  it," not "receive writes on Citadel's behalf."
- **Video output review**: clicking "View Output" opens a popup that
  autoplays the rendered video (also proxied from Drive) with a notes box
  underneath. Submitting notes writes the new `revision_requested` status
  and the notes directly to Supabase — picking that up and actually fixing
  it is a future agent step, not built yet.
- **Notifications**: derived live from real error fields on `videos`
  (per-segment, per-clip, per-asset, render, and stuck-delivery states) —
  not a separate stored table, so there's nothing to keep in sync. Read/
  unread state is client-side only for now.

Everything talks to Supabase and n8n through Citadel's own API routes
(`src/app/api/*`) — the browser never holds Supabase credentials.

**Architecture principle**: pure database changes (status transitions,
queueing a retry, revision notes) are written directly from Citadel's API
routes to Supabase using the service-role key. n8n workflows exist to
*interpret* the current state of the database and route items to whatever
action their state calls for (dispatch to Chatterbox, render, etc.) — not
to act as a passthrough for writes Citadel can make itself. n8n webhooks
are still the right tool for anything that needs n8n to actually *do*
something external (call a service, upload a file) — just not for a plain
column update.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — service role key, never
     the anon key (these API routes run server-side only).
   - `N8N_BASE_URL` — e.g. `https://n8n.viralnotely.com`
   - `CITADEL_PASSWORD` — the login password.
   - `CITADEL_SESSION_SECRET` — long random string (`openssl rand -hex 32`);
     changing it logs everyone out.
3. `npm run dev`

## Deploying

Runs on Vercel — import this repo (Next.js auto-detected) and set the five
environment variables above in the Vercel dashboard. No VPS involved.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS v4 + next-themes (real
dark/light toggle — both palettes are plain CSS variables in
`globals.css`, dark is the pixel-exact original design). No client-side
Supabase SDK.
