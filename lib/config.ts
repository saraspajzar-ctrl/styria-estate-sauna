// Central business-rule configuration mirrored on the client for UX only.
// The database (supabase/migrations/0003_functions.sql) is the authoritative
// enforcement point for every one of these rules — nothing here should ever
// be trusted as the real gate.

export const TIMEZONE = "Europe/Ljubljana";
export const MAX_DAILY_MINUTES_PER_STAY = 120; // 2 hours / stay / calendar day
export const ALLOWED_DURATIONS_MINUTES = [30, 60, 90, 120] as const;
export const MAX_GUESTS_PER_RESERVATION = 4; // sauna capacity ceiling
export const SLOT_INCREMENT_MINUTES = 30;

// The check-in day is eligible for sauna reservations; the check-out day is
// not (standard accommodation convention — the guest has left by then).
export const INCLUDE_CHECKOUT_DAY = false;

export type AllowedDuration = (typeof ALLOWED_DURATIONS_MINUTES)[number];
