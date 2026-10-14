"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { SaunaTimeline } from "@/components/SaunaTimeline";
import { ALLOWED_DURATIONS_MINUTES, TIMEZONE } from "@/lib/config";
import { computeEndTime, formatDisplayDate, todayInTimeZone } from "@/lib/time";
import { AdminReservation, Apartment, DailyAllowance, ScheduleSlot, Stay } from "@/lib/types";

function formatMinutesLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export default function AdminSchedulePage() {
  const [date, setDate] = useState(() => todayInTimeZone(TIMEZONE));
  const [apartmentFilter, setApartmentFilter] = useState("");
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [dayReservations, setDayReservations] = useState<AdminReservation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<DailyAllowance | null>(null);

  const [form, setForm] = useState({
    stayId: "",
    startTime: "08:00",
    durationMinutes: 60,
    numberOfGuests: 1,
  });

  useEffect(() => {
    fetch("/api/admin/apartments")
      .then((r) => r.json())
      .then((d) => setApartments(d.apartments ?? []));
    fetch("/api/admin/stays?status=active")
      .then((r) => r.json())
      .then((d) => {
        setStays(d.stays ?? []);
        setForm((f) => ({ ...f, stayId: f.stayId || d.stays?.[0]?.id || "" }));
      });
  }, []);

  const refresh = useCallback(async () => {
    const reservationsParams = new URLSearchParams({ date });
    if (apartmentFilter) reservationsParams.set("apartmentId", apartmentFilter);

    const [scheduleRes, listRes] = await Promise.all([
      fetch(`/api/admin/schedule?date=${date}`),
      fetch(`/api/admin/reservations?${reservationsParams.toString()}`),
    ]);
    const scheduleData = await scheduleRes.json();
    const listData = await listRes.json();
    setSlots(scheduleData.slots ?? []);
    setDayReservations(listData.reservations ?? []);
  }, [date, apartmentFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-date-change
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!form.stayId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale allowance for a different stay
      setAllowance(null);
      return;
    }
    fetch(`/api/admin/stays/${form.stayId}/allowance?date=${date}`)
      .then((r) => r.json())
      .then((d) => setAllowance(d.allowance ?? null));
  }, [form.stayId, date]);

  const endTime = useMemo(
    () => computeEndTime(form.startTime, form.durationMinutes),
    [form.startTime, form.durationMinutes]
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);

    const payload = {
      stayId: form.stayId,
      reservationDate: date,
      startTime: form.startTime,
      durationMinutes: form.durationMinutes,
      numberOfGuests: form.numberOfGuests,
    };

    const url = editingId ? `/api/admin/reservations/${editingId}` : "/api/admin/reservations";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setFormError(data.error ?? "Could not save reservation.");
      return;
    }
    setNotice(editingId ? "Reservation updated." : "Reservation created.");
    setEditingId(null);
    await refresh();
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/admin/reservations/${id}`, { method: "DELETE" });
    if (res.ok) await refresh();
  }

  function handleEdit(r: AdminReservation) {
    setEditingId(r.id);
    setForm({
      stayId: r.stay_id,
      startTime: r.start_time.slice(0, 5),
      durationMinutes: r.duration_minutes,
      numberOfGuests: r.number_of_guests,
    });
    setFormError(null);
    setNotice(null);
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center gap-4">
        <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Date
        </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-forest"
        />
        <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Apartment
        </label>
        <select
          value={apartmentFilter}
          onChange={(e) => setApartmentFilter(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink outline-none focus:border-forest"
        >
          <option value="">All apartments</option>
          {apartments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Sauna — {formatDisplayDate(date)}
          </p>
          <SaunaTimeline slots={slots} />
        </section>

        <section className="space-y-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              {editingId ? "Edit reservation" : "Create reservation"}
            </p>
            <form
              onSubmit={handleCreate}
              className="space-y-3 rounded-2xl border border-line bg-card p-5"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Stay
                </label>
                <select
                  value={form.stayId}
                  onChange={(e) => setForm((f) => ({ ...f, stayId: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
                >
                  {stays.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.guest_surname} — {s.apartment?.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    Start time
                  </label>
                  <input
                    type="time"
                    step={1800}
                    value={form.startTime}
                    onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                    className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    Duration
                  </label>
                  <select
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))
                    }
                    className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
                  >
                    {ALLOWED_DURATIONS_MINUTES.map((d) => (
                      <option key={d} value={d}>
                        {formatMinutesLabel(d)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  Guests
                </label>
                <select
                  value={form.numberOfGuests}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, numberOfGuests: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-line bg-stone px-3 py-2.5 text-sm outline-none focus:border-forest"
                >
                  {[1, 2, 3, 4].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-ink-soft">
                {form.startTime} – {endTime}
                {allowance && ` · ${formatMinutesLabel(allowance.remainingMinutes)} remaining today for this stay`}
              </p>
              {formError && (
                <p className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{formError}</p>
              )}
              {notice && (
                <p className="rounded-xl bg-available px-3 py-2 text-sm text-forest-light">
                  {notice}
                </p>
              )}
              <div className="flex gap-2">
                {editingId && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel edit
                  </Button>
                )}
                <Button type="submit" className="flex-1">
                  {editingId ? "Save changes" : "Create reservation"}
                </Button>
              </div>
            </form>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Reservations on {formatDisplayDate(date)}
            </p>
            {dayReservations.length === 0 ? (
              <p className="rounded-2xl border border-line bg-card p-4 text-sm text-ink-soft">
                No reservations for this date.
              </p>
            ) : (
              <ul className="space-y-2">
                {dayReservations.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-card p-4 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink">{r.apartment_name}</span>
                      <span className="text-ink-soft">
                        {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                      </span>
                    </div>
                    <p className="text-ink-soft">
                      {r.guest_surname} · {r.number_of_guests} guest
                      {r.number_of_guests > 1 ? "s" : ""}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Button
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => handleEdit(r)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => handleCancel(r.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
