import { createClient } from "@supabase/supabase-js";

// Service-role client - only ever imported from server-side code (API routes,
// server components). The service role key must NEVER be exposed to the
// browser, which is exactly why Citadel talks to Supabase through its own
// API routes instead of a client-side Supabase SDK, unlike vn-dashboard.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
