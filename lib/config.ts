// Central business-rule configuration mirrored on the client for UX only.
// The database (supabase/migrations/*.sql, especially 0006) is the
// authoritative enforcement point for every one of these rules — nothing
// here should ever be trusted as the real gate.

export const TIMEZONE = "Europe/Ljubljana";
export const MAX_DAILY_MINUTES_PER_STAY = 60; // 1 hour / stay / calendar day
export const ALLOWED_DURATIONS_MINUTES = [30, 60] as const;
export const SLOT_INCREMENT_MINUTES = 30;

// Guests must book at least this many calendar days ahead of today (in
// TIMEZONE); there's no upper bound on how far in advance they can book.
// Admin-created reservations are exempt from this.
export const MIN_ADVANCE_DAYS = 1;

// The check-in day is eligible for sauna reservations; the check-out day is
// not (standard accommodation convention — the guest has left by then).
export const INCLUDE_CHECKOUT_DAY = false;

export type AllowedDuration = (typeof ALLOWED_DURATIONS_MINUTES)[number];
