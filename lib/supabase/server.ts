import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Supabase client bound to the current request's cookies, running as the
 * signed-in admin user (anon key + the user's JWT). Subject to RLS — used
 * only to check the admin's own session / `admins` membership row, never for
 * business data (that goes through the service-role client).
 */
export async function getSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render; the proxy already
            // refreshes the session cookie on navigation, so this is safe
            // to ignore here.
          }
        },
      },
    }
  );
}
