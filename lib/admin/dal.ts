import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminSession = {
  userId: string;
  email: string | null;
  displayName: string | null;
};

/**
 * Verifies the caller is a signed-in Supabase Auth user AND has an active
 * row in `admins`. Being authenticated is not sufficient on its own — this
 * is the actual authorization gate, checked on every admin page and every
 * admin API route (never trust the proxy's optimistic check alone).
 */
export const verifyAdmin = cache(async (): Promise<AdminSession | null> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: admin } = await supabase
    .from("admins")
    .select("user_id, display_name, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (!admin) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    displayName: admin.display_name,
  };
});

/** For Server Components / pages: redirects to login if not an admin. */
export async function requireAdminPage(): Promise<AdminSession> {
  const admin = await verifyAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

/** For Route Handlers: returns null instead of redirecting; caller returns 401/403. */
export async function requireAdminApi(): Promise<AdminSession | null> {
  return verifyAdmin();
}
