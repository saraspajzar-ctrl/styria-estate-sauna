// Acceptance tests for the business rules in supabase/migrations/*_functions.sql.
//
// These are integration tests that run against the REAL provisioned Supabase
// database (the same one the app uses) — the whole point of pushing the
// rules into Postgres functions + an exclusion constraint is that they only
// mean something when verified against the actual database engine, not a
// mocked one. Test fixtures (stays/reservations) are created and then hard
// deleted in a finally block; nothing here touches real guest data.
//
// Run with: npm test

import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import assert from "node:assert/strict";
import { Client as PgClient } from "pg";
import { addDaysISO, todayInTimeZone } from "../lib/time";
import { TIMEZONE } from "../lib/config";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PEPPER = process.env.ACCESS_CODE_PEPPER!;
const ADMIN_API_BASE = process.env.TEST_BASE_URL; // optional, e.g. http://localhost:3000

if (!SUPABASE_URL || !SERVICE_KEY || !PEPPER) {
  console.error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ACCESS_CODE_PEPPER must be set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function hashCode(code: string): string {
  return createHmac("sha256", PEPPER).update(code).digest("hex");
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name}`);
    console.log(`       ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

type Fixture = { stayIds: string[]; reservationIds: string[]; resourceIds: string[] };
const fixture: Fixture = { stayIds: [], reservationIds: [], resourceIds: [] };

/**
 * A disposable, isolated resource for tests that must book real near-term
 * dates (today/tomorrow) to exercise the lead-time rule. Using a throwaway
 * resource — rather than the real shared sauna — means these assertions can
 * never collide with, or become momentarily visible alongside, an actual
 * guest's reservation on the live sauna calendar. Open 24h so time-of-day
 * never interferes with what's being tested.
 */
async function createTestResource(): Promise<string> {
  const { data, error } = await supabase
    .from("resources")
    .insert({
      name: `Test Resource ${Math.random().toString(36).slice(2, 10)}`,
      capacity: 4,
      open_time: "00:00",
      close_time: "23:30",
      active: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  fixture.resourceIds.push(data.id);
  return data.id;
}

async function getApartmentIds(): Promise<string[]> {
  const { data, error } = await supabase.from("apartments").select("id").order("name");
  if (error) throw error;
  if (!data || data.length < 2) throw new Error("Expected at least 2 seeded apartments.");
  return data.map((a) => a.id);
}

async function getResourceId(): Promise<string> {
  const { data, error } = await supabase
    .from("resources")
    .select("id")
    .eq("active", true)
    .limit(1)
    .single();
  if (error || !data) throw new Error("Expected an active sauna resource.");
  return data.id;
}

async function createStay(apartmentId: string, checkIn: string, checkOut: string) {
  const code = `TEST-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const { data, error } = await supabase.rpc("admin_create_stay", {
    p_apartment_id: apartmentId,
    p_guest_surname: "Test Guest",
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_access_code_hash: hashCode(code),
    p_admin_user_id: null,
  });
  if (error) throw error;
  fixture.stayIds.push(data.id);
  return { stay: data, code };
}

function book(input: {
  stayId: string;
  resourceId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}) {
  return supabase.rpc("book_sauna_reservation", {
    p_stay_id: input.stayId,
    p_resource_id: input.resourceId,
    p_reservation_date: input.date,
    p_start_time: input.startTime,
    p_duration_minutes: input.durationMinutes,
    p_is_admin: false,
    p_admin_user_id: null,
  });
}

function errCode(error: { message: string } | null): string {
  if (!error) return "";
  const match = error.message.match(/^([A-Z_]+):/);
  return match ? match[1] : error.message;
}

async function cleanup() {
  if (fixture.reservationIds.length) {
    await supabase.from("sauna_reservations").delete().in("id", fixture.reservationIds);
  }
  if (fixture.stayIds.length) {
    await supabase.from("sauna_reservations").delete().in("stay_id", fixture.stayIds);
    await supabase.from("stays").delete().in("id", fixture.stayIds);
  }
  if (fixture.resourceIds.length) {
    await supabase.from("sauna_reservations").delete().in("resource_id", fixture.resourceIds);
    await supabase.from("resources").delete().in("id", fixture.resourceIds);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function main() {
  const [apartmentA, apartmentB] = await getApartmentIds();
  const resourceId = await getResourceId();

  // Every test that doesn't specifically test date-boundary behavior gets
  // its own calendar date, so concurrent/sequential tests never compete for
  // the single shared sauna resource on the same day.
  let dayCounter = 10;
  function freshDate(): string {
    return `2099-06-${String(dayCounter++).padStart(2, "0")}`;
  }

  await test("a stay's full 60-minute daily allowance can be used across multiple bookings (guests sharing one code)", async () => {
    const testDate = freshDate();
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const first = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(first.error, null, `first booking should succeed: ${first.error?.message}`);
    fixture.reservationIds.push(first.data.id);

    const second = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "16:30",
      durationMinutes: 30,
    });
    assert.equal(second.error, null, `second booking should succeed: ${second.error?.message}`);
    fixture.reservationIds.push(second.data.id);

    // 60 minutes used — a third booking of any length must be rejected,
    // regardless of which guest sharing the code makes the request.
    const third = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "17:00",
      durationMinutes: 30,
    });
    assert.equal(errCode(third.error), "DAILY_LIMIT_EXCEEDED");
  });

  await test("two bookings against the same stay cannot jointly exceed the shared daily allowance", async () => {
    const testDate = freshDate();
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const a = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(a.error, null);
    fixture.reservationIds.push(a.data.id);

    // 30 used, 30 remain — a 60-minute request must be rejected even though
    // it comes from "a different guest" using the same stay/code.
    const b = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "17:00",
      durationMinutes: 60,
    });
    assert.equal(errCode(b.error), "DAILY_LIMIT_EXCEEDED");
  });

  await test("two different apartments cannot book overlapping sauna times", async () => {
    const testDate = freshDate();
    const { stay: stayA } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const { stay: stayB } = await createStay(apartmentB, "2099-06-10", "2099-06-20");

    const a = await book({
      stayId: stayA.id,
      resourceId,
      date: testDate,
      startTime: "16:00",
      durationMinutes: 60,
    });
    assert.equal(a.error, null);
    fixture.reservationIds.push(a.data.id);

    const b = await book({
      stayId: stayB.id,
      resourceId,
      date: testDate,
      startTime: "16:30", // overlaps 16:00-17:00
      durationMinutes: 30,
    });
    assert.equal(errCode(b.error), "SLOT_UNAVAILABLE");
  });

  await test("simultaneous booking requests for the same slot cannot both succeed", async () => {
    const testDate = freshDate();
    const { stay: stayA } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const { stay: stayB } = await createStay(apartmentB, "2099-06-10", "2099-06-20");

    const [a, b] = await Promise.all([
      book({
        stayId: stayA.id,
        resourceId,
        date: testDate,
        startTime: "17:00",
        durationMinutes: 30,
      }),
      book({
        stayId: stayB.id,
        resourceId,
        date: testDate,
        startTime: "17:00",
        durationMinutes: 30,
      }),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => !r.error);
    const failedOnes = results.filter((r) => r.error);
    assert.equal(succeeded.length, 1, "exactly one concurrent request should succeed");
    assert.equal(failedOnes.length, 1);
    assert.equal(errCode(failedOnes[0].error), "SLOT_UNAVAILABLE");
    fixture.reservationIds.push(...succeeded.map((r) => r.data.id));
  });

  await test("simultaneous booking requests against the same stay cannot both exceed the daily allowance", async () => {
    const testDate = freshDate();
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");

    // Two concurrent 60-minute requests at non-overlapping times: only one
    // can fit under the 60-minute cap even though neither overlaps the
    // other in time.
    const [a, b] = await Promise.all([
      book({
        stayId: stay.id,
        resourceId,
        date: testDate,
        startTime: "16:00",
        durationMinutes: 60,
      }),
      book({
        stayId: stay.id,
        resourceId,
        date: testDate,
        startTime: "17:30",
        durationMinutes: 60,
      }),
    ]);

    const results = [a, b];
    const succeeded = results.filter((r) => !r.error);
    const failedOnes = results.filter((r) => r.error);
    assert.equal(succeeded.length, 1, "only one of the two should fit the daily allowance");
    assert.equal(errCode(failedOnes[0].error), "DAILY_LIMIT_EXCEEDED");
    fixture.reservationIds.push(...succeeded.map((r) => r.data.id));
  });

  await test("cancelling a reservation releases its time slot and its allowance", async () => {
    const testDate = freshDate();
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const a = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "16:00",
      durationMinutes: 60,
    });
    assert.equal(a.error, null);

    const cancel = await supabase.rpc("cancel_sauna_reservation", {
      p_reservation_id: a.data.id,
      p_stay_id: stay.id,
      p_is_admin: false,
      p_admin_user_id: null,
    });
    assert.equal(cancel.error, null);

    // Same slot, same stay, full 60 minutes again — must succeed now.
    const rebook = await book({
      stayId: stay.id,
      resourceId,
      date: testDate,
      startTime: "16:00",
      durationMinutes: 60,
    });
    assert.equal(rebook.error, null, `rebooking after cancellation should succeed: ${rebook.error?.message}`);
    fixture.reservationIds.push(rebook.data.id);
  });

  await test("reservations outside the stay period are rejected (before check-in and on/after check-out)", async () => {
    const { stay } = await createStay(apartmentA, "2099-07-10", "2099-07-13");

    const beforeCheckIn = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-07-09",
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(errCode(beforeCheckIn.error), "OUTSIDE_STAY");

    const onCheckOutDay = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-07-13",
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(errCode(onCheckOutDay.error), "OUTSIDE_STAY");

    const onCheckInDay = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-07-10",
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(onCheckInDay.error, null, "the check-in day itself must be bookable");
    fixture.reservationIds.push(onCheckInDay.data.id);
  });

  await test("reservations outside operating hours (16:00-19:00) are rejected", async () => {
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");

    const tooEarly = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-06-18",
      startTime: "15:30",
      durationMinutes: 30,
    });
    assert.equal(errCode(tooEarly.error), "OUTSIDE_HOURS");

    const tooLate = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-06-18",
      startTime: "18:30",
      durationMinutes: 60, // would end at 19:30
    });
    assert.equal(errCode(tooLate.error), "OUTSIDE_HOURS");

    const exactlyAtClose = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-06-18",
      startTime: "18:00",
      durationMinutes: 60, // ends exactly at 19:00 — allowed
    });
    assert.equal(exactlyAtClose.error, null, "a reservation ending exactly at close time must be allowed");
    fixture.reservationIds.push(exactlyAtClose.data.id);
  });

  await test("durations other than 30 or 60 minutes are rejected", async () => {
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const result = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-06-19",
      startTime: "16:00",
      durationMinutes: 90,
    });
    assert.equal(errCode(result.error), "INVALID_DURATION");
  });

  await test("guest bookings less than 1 day in advance are rejected, but next-day and later are allowed", async () => {
    // Uses a disposable resource (not the real sauna) since this test must
    // book real near-term dates — see createTestResource().
    const testResourceId = await createTestResource();
    const today = todayInTimeZone(TIMEZONE);
    const tomorrow = addDaysISO(today, 1);
    const { stay } = await createStay(apartmentA, today, addDaysISO(today, 10));

    const sameDay = await book({
      stayId: stay.id,
      resourceId: testResourceId,
      date: today,
      startTime: "10:00",
      durationMinutes: 30,
    });
    assert.equal(errCode(sameDay.error), "LEAD_TIME_REQUIRED");

    const nextDay = await book({
      stayId: stay.id,
      resourceId: testResourceId,
      date: tomorrow,
      startTime: "10:00",
      durationMinutes: 30,
    });
    assert.equal(nextDay.error, null, `booking for tomorrow should succeed: ${nextDay.error?.message}`);
    fixture.reservationIds.push(nextDay.data.id);
  });

  await test("admin-created reservations are exempt from the 1-day lead-time requirement", async () => {
    const testResourceId = await createTestResource();
    const today = todayInTimeZone(TIMEZONE);
    const { stay } = await createStay(apartmentA, today, addDaysISO(today, 10));

    const result = await supabase.rpc("book_sauna_reservation", {
      p_stay_id: stay.id,
      p_resource_id: testResourceId,
      p_reservation_date: today,
      p_start_time: "10:00",
      p_duration_minutes: 30,
      p_is_admin: true,
      p_admin_user_id: null,
    });
    assert.equal(result.error, null, `admin same-day booking should succeed: ${result.error?.message}`);
    fixture.reservationIds.push(result.data.id);
  });

  await test("a stay's access code cannot be used to look up a different stay", async () => {
    const { stay: stayA, code: codeA } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    await createStay(apartmentB, "2099-06-10", "2099-06-20");

    const { data, error } = await supabase
      .from("stays")
      .select("id")
      .eq("access_code_hash", hashCode(codeA))
      .eq("status", "active")
      .eq("access_code_revoked", false)
      .maybeSingle();
    assert.equal(error, null);
    assert.equal(data?.id, stayA.id, "the hash must resolve to exactly the stay it was issued for");
  });

  await test("a revoked access code no longer resolves to its stay", async () => {
    const { stay, code } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const revoke = await supabase.rpc("admin_revoke_access_code", {
      p_stay_id: stay.id,
      p_admin_user_id: null,
    });
    assert.equal(revoke.error, null);

    const { data } = await supabase
      .from("stays")
      .select("id")
      .eq("access_code_hash", hashCode(code))
      .eq("status", "active")
      .eq("access_code_revoked", false)
      .maybeSingle();
    assert.equal(data, null, "a revoked code must not resolve to any stay");
  });

  await test("invalid access-code attempts are rate-limited per IP after repeated failures", async () => {
    const ipHash = `test-ip-${Math.random().toString(36).slice(2, 10)}`;
    const WINDOW_SECONDS = 15 * 60;
    const MAX_ATTEMPTS = 10;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await supabase.from("access_code_attempts").insert({ ip_hash: ipHash, success: false });
    }

    const windowStart = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
    const { count, error } = await supabase
      .from("access_code_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);
    assert.equal(error, null);
    assert.ok((count ?? 0) >= MAX_ATTEMPTS, "attempt count should have reached the rate-limit threshold");

    await supabase.from("access_code_attempts").delete().eq("ip_hash", ipHash);
  });

  await test("daily allowance aggregation uses the Europe/Ljubljana calendar date, not UTC", async () => {
    // In late June, Ljubljana is UTC+2 (CEST), so 16:00 local is 14:00 UTC —
    // a naive UTC-based grouping would still land on the same calendar day
    // here, so this instead directly asserts the stored instant converts
    // back to the exact local wall-clock time, proving the conversion path
    // is timezone-aware rather than coincidentally correct.
    const { stay } = await createStay(apartmentA, "2099-06-10", "2099-06-20");
    const result = await book({
      stayId: stay.id,
      resourceId,
      date: "2099-06-19",
      startTime: "16:00",
      durationMinutes: 30,
    });
    assert.equal(result.error, null);
    fixture.reservationIds.push(result.data.id);

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const pg = new PgClient({
      connectionString: process.env.POSTGRES_URL_NON_POOLING,
      ssl: { rejectUnauthorized: false },
    });
    await pg.connect();
    try {
      const { rows } = await pg.query(
        `select to_char(starts_at at time zone 'Europe/Ljubljana', 'YYYY-MM-DD HH24:MI') as local
         from sauna_reservations where id = $1`,
        [result.data.id]
      );
      assert.equal(rows[0].local, "2099-06-19 16:00");
    } finally {
      await pg.end();
    }
  });

  if (ADMIN_API_BASE) {
    await test("admin API routes reject requests without an admin session", async () => {
      const res = await fetch(`${ADMIN_API_BASE}/api/admin/stays`);
      assert.equal(res.status, 401);
    });
  } else {
    console.log(
      "  skip admin API auth check (set TEST_BASE_URL to a running dev server to include it)"
    );
  }
}

main()
  .catch((err) => {
    console.error("Unexpected test runner failure:", err);
    failed++;
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) {
      console.log("Failed: " + failures.join(", "));
      process.exit(1);
    }
  });
