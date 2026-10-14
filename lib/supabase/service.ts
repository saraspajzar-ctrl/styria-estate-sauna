import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses Row Level Security entirely.
 *
 * NEVER import this module from a Client Component or expose its output to
 * the browser. It must only be used inside Route Handlers, Server Actions,
 * or other server-only code. All guest- and admin-facing business logic
 * runs through this client so there is exactly one, fully-controlled path
 * into the database.
 */
let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
