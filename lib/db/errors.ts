import "server-only";

/**
 * The SQL functions in supabase/migrations/0003_functions.sql raise errors
 * shaped as "CODE: human-readable message". Supabase surfaces that full
 * string as `error.message` (and often restates it in `error.details`).
 * This extracts a clean {code, message} pair for API responses.
 */
export function parseDbError(error: { message?: string; details?: string | null }): {
  code: string;
  message: string;
} {
  const raw = error.message || error.details || "Something went wrong.";
  const match = raw.match(/([A-Z_]+):\s*([\s\S]*)$/);
  if (match) {
    return { code: match[1], message: match[2].trim() };
  }
  return { code: "UNKNOWN", message: raw };
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_DURATION: 400,
  INVALID_GUESTS: 400,
  INVALID_START_TIME: 400,
  INVALID_DATES: 400,
  STAY_NOT_FOUND: 404,
  STAY_INACTIVE: 403,
  OUTSIDE_STAY: 400,
  RESOURCE_NOT_FOUND: 404,
  OUTSIDE_HOURS: 400,
  DAILY_LIMIT_EXCEEDED: 409,
  SLOT_UNAVAILABLE: 409,
  RESERVATION_NOT_FOUND: 404,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  UNKNOWN: 500,
};

export function statusForCode(code: string): number {
  return STATUS_BY_CODE[code] ?? 400;
}
