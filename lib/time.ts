// Minimal, dependency-free time helpers. All reservation times are stored as
// "HH:mm" 24h strings and calendar dates as "YYYY-MM-DD" strings, so they are
// unambiguous and never affected by timezone conversion.

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (totalMinutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function computeEndTime(startTime: string, durationMinutes: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMinutes);
}

export function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  const aS = timeToMinutes(aStart);
  const aE = timeToMinutes(aEnd);
  const bS = timeToMinutes(bStart);
  const bE = timeToMinutes(bEnd);
  return aS < bE && bS < aE;
}

export function todayISO(): string {
  const d = new Date();
  return dateToISO(d);
}

/**
 * "Today" as a calendar date in the property's local timezone, independent
 * of the server's (or browser's) own timezone. Used anywhere the app needs
 * the authoritative current date rather than cosmetic defaults.
 */
export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function dateToISO(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = parseISODate(iso);
  return dateToISO(d) === iso;
}

/** All calendar dates a stay can book, per INCLUDE_CHECKOUT_DAY. */
export function datesInStay(
  checkInISO: string,
  checkOutISO: string,
  includeCheckoutDay: boolean
): string[] {
  const dates: string[] = [];
  const checkIn = parseISODate(checkInISO.slice(0, 10));
  const checkOut = parseISODate(checkOutISO.slice(0, 10));
  const lastInclusive = includeCheckoutDay
    ? checkOut
    : new Date(checkOut.getTime() - 86400000);
  const cursor = new Date(checkIn);
  while (cursor.getTime() <= lastInclusive.getTime()) {
    dates.push(dateToISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function formatDisplayDate(iso: string): string {
  const d = parseISODate(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
