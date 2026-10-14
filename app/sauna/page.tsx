"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AllowanceCard } from "@/components/AllowanceCard";
import { BookingPanel } from "@/components/BookingPanel";
import { Button } from "@/components/Button";
import { SaunaTimeline } from "@/components/SaunaTimeline";
import { INCLUDE_CHECKOUT_DAY, TIMEZONE } from "@/lib/config";
import { datesInStay, formatDisplayDate, todayInTimeZone } from "@/lib/time";
import { DailyAllowance, GuestReservation, GuestStayView, ScheduleSlot } from "@/lib/types";

type ViewState = "loading" | "gate" | "dashboard";

export default function SaunaPage() {
  const [view, setView] = useState<ViewState>("loading");
  const [stay, setStay] = useState<GuestStayView | null>(null);

  const [code, setCode] = useState("");
  const [gateError, setGateError] = useState<string | null>(null);
  const [gateLoading, setGateLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [allowance, setAllowance] = useState<DailyAllowance | null>(null);
  const [myReservations, setMyReservations] = useState<GuestReservation[]>([]);
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [editing, setEditing] = useState<GuestReservation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/guest/me");
    if (res.ok) {
      const data = await res.json();
      setStay(data.stay);
      setView("dashboard");
    } else {
      setView("gate");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional session check on mount
    loadMe();
  }, [loadMe]);

  const dates = useMemo(
    () => (stay ? datesInStay(stay.checkIn, stay.checkOut, INCLUDE_CHECKOUT_DAY) : []),
    [stay]
  );

  useEffect(() => {
    if (dates.length > 0 && !selectedDate) {
      const today = todayInTimeZone(TIMEZONE);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- deriving initial date selection once stay is known
      setSelectedDate(dates.includes(today) ? today : dates[0]);
    }
  }, [dates, selectedDate]);

  const refreshSchedule = useCallback(async () => {
    if (!selectedDate) return;
    const res = await fetch(`/api/guest/schedule?date=${selectedDate}`);
    if (!res.ok) return;
    const data = await res.json();
    setSlots(data.slots ?? []);
  }, [selectedDate]);

  const refreshAllowance = useCallback(async () => {
    if (!selectedDate) return;
    const excludeParam = editing ? `&exclude=${editing.id}` : "";
    const res = await fetch(`/api/guest/allowance?date=${selectedDate}${excludeParam}`);
    if (!res.ok) return;
    const data = await res.json();
    setAllowance(data.allowance ?? null);
  }, [selectedDate, editing]);

  const refreshMyReservations = useCallback(async () => {
    const res = await fetch("/api/guest/reservations");
    if (!res.ok) return;
    const data = await res.json();
    setMyReservations(data.reservations ?? []);
  }, []);

  useEffect(() => {
    if (view !== "dashboard") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-date-change
    refreshSchedule();
    refreshAllowance();
    refreshMyReservations();
  }, [view, refreshSchedule, refreshAllowance, refreshMyReservations]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setGateError(null);
    setGateLoading(true);
    const res = await fetch("/api/guest/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setGateLoading(false);
    if (!res.ok) {
      setGateError(data.error ?? "Invalid access code.");
      return;
    }
    setStay(data.stay);
    setView("dashboard");
  }

  async function handleLogout() {
    await fetch("/api/guest/logout", { method: "POST" });
    setStay(null);
    setCode("");
    setSelectedDate("");
    setView("gate");
  }

  async function submitReservation(durationMinutes: number) {
    if (!draftStart) return "Something went wrong.";

    const isEdit = !!editing;
    const url = isEdit ? `/api/guest/reservations/${editing!.id}` : "/api/guest/reservations";
    const method = isEdit ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationDate: selectedDate,
        startTime: draftStart,
        durationMinutes,
      }),
    });
    const data = await res.json();
    if (!res.ok) return data.error ?? "Could not save reservation.";

    await Promise.all([refreshSchedule(), refreshAllowance(), refreshMyReservations()]);
    return null;
  }

  async function cancelReservation(id: string) {
    setActionError(null);
    const res = await fetch(`/api/guest/reservations/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setActionError(data.error ?? "Could not cancel reservation.");
      return;
    }
    await Promise.all([refreshSchedule(), refreshAllowance(), refreshMyReservations()]);
  }

  function startEdit(r: GuestReservation) {
    setSelectedDate(r.reservation_date);
    setEditing(r);
    setDraftStart(r.start_time.slice(0, 5));
  }

  function closePanel() {
    setDraftStart(null);
    setEditing(null);
  }

  if (view === "loading") return null;

  if (view === "gate") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-16">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center">
            <Image
              src="/brand/styria-wordmark.png"
              alt="Styria Estate"
              width={1053}
              height={734}
              priority
              className="mx-auto h-24 w-auto"
            />
            <h1 className="mt-4 font-display text-2xl italic text-ink">Sauna Reservation</h1>
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Enter the access code from your booking confirmation to view sauna availability and
              make a reservation.
            </p>
          </div>

          <form
            onSubmit={handleVerify}
            className="space-y-5 rounded-3xl border border-line bg-card p-6 shadow-sm"
          >
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                Access code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. 7KPM-Q2XD"
                autoCapitalize="characters"
                className="w-full rounded-xl border border-line bg-stone px-4 py-3 text-center font-mono text-lg tracking-widest text-ink outline-none focus:border-forest"
              />
            </div>
            {gateError && (
              <p className="rounded-xl bg-clay/10 px-4 py-2.5 text-sm text-clay">{gateError}</p>
            )}
            <Button type="submit" disabled={gateLoading} className="w-full">
              {gateLoading ? "Checking…" : "Continue"}
            </Button>
          </form>
        </div>
      </main>
    );
  }

  if (!stay) return null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/se-mark.png"
            alt="Styria Estate"
            width={544}
            height={726}
            className="h-10 w-auto"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-soft">
              Styria Estate
            </p>
            <h1 className="font-display text-xl italic text-ink">Sauna Reservation</h1>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-semibold uppercase tracking-widest text-ink-soft hover:text-ink"
        >
          Sign out
        </button>
      </header>

      <section className="mb-6 rounded-2xl border border-line bg-card p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Guest Information
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="font-semibold text-ink">{stay.apartmentName}</span>
          <span className="text-ink-soft">
            {formatDisplayDate(stay.checkIn.slice(0, 10))} →{" "}
            {formatDisplayDate(stay.checkOut.slice(0, 10))}
          </span>
        </div>
      </section>

      {allowance && selectedDate && (
        <section className="mb-6">
          <AllowanceCard
            apartmentName={stay.apartmentName}
            dateLabel={formatDisplayDate(selectedDate)}
            allowance={allowance}
          />
        </section>
      )}

      <section className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Select a date
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dates.map((d) => (
            <button
              key={d}
              onClick={() => {
                setSelectedDate(d);
                closePanel();
              }}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                d === selectedDate
                  ? "border-forest bg-forest text-stone"
                  : "border-line bg-card text-ink hover:border-forest"
              }`}
            >
              {formatDisplayDate(d).replace(/, \d{4}$/, "")}
            </button>
          ))}
        </div>
      </section>

      {actionError && (
        <p className="mb-4 rounded-xl bg-clay/10 px-4 py-2.5 text-sm text-clay">{actionError}</p>
      )}

      <section className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Sauna Availability
        </p>
        {draftStart && allowance ? (
          <BookingPanel
            mode={editing ? "edit" : "create"}
            apartmentName={stay.apartmentName}
            surname=""
            date={selectedDate}
            startTime={draftStart}
            slots={slots}
            allowance={allowance}
            initialDuration={editing?.duration_minutes}
            onCancel={closePanel}
            onSubmit={submitReservation}
          />
        ) : (
          <SaunaTimeline slots={slots} onSelectTime={(time) => setDraftStart(time)} />
        )}
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          My Reservations
        </p>
        {myReservations.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-5 text-sm text-ink-soft">
            No sauna reservations yet. Select an available time above to book one.
          </p>
        ) : (
          <ul className="space-y-3">
            {myReservations.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-line bg-card p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {formatDisplayDate(r.reservation_date)}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {r.start_time.slice(0, 5)} – {r.end_time.slice(0, 5)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => startEdit(r)}
                    className="!px-4 !py-2 text-xs"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => cancelReservation(r.id)}
                    className="!px-4 !py-2 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
