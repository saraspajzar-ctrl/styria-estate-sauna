import "server-only";
import { createHash } from "crypto";
import { getServiceClient } from "@/lib/supabase/service";

const WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_ATTEMPTS = 10;

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex");
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Throws if the given IP has exceeded the attempt budget in the current window. */
export async function assertNotRateLimited(ipHash: string): Promise<void> {
  const supabase = getServiceClient();
  const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

  const { count, error } = await supabase
    .from("access_code_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", windowStart);

  if (error) throw error;

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    throw new Error("RATE_LIMITED: Too many attempts. Please try again in a few minutes.");
  }
}

export async function recordAccessAttempt(ipHash: string, success: boolean): Promise<void> {
  const supabase = getServiceClient();
  await supabase.from("access_code_attempts").insert({ ip_hash: ipHash, success });
}
