"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { ALLOWED_DURATIONS_MINUTES } from "@/lib/config";
import { DailyAllowance, ScheduleSlot } from "@/lib/types";
import { computeEndTime, formatDisplayDate } from "@/lib/time";

type Props = {
  mode: "create" | "edit";
  apartmentName: string;
  surname: string;
  date: string;
  startTime: string;
  slots: ScheduleSlot[];
  allowance: DailyAllowance;
  initialDuration?: number;
  initialGuests?: number;
  onCancel: () => void;
  onSubmit: (durationMinutes: number, numberOfGuests: number) => Promise<string | null>;
};

function formatMinutesLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function BookingPanel({
  apartmentName,
  surname,
  date,
  startTime,
  slots,
  allowance,
  initialDuration,
  initialGuests,
  onCancel,
  onSubmit,
}: Props) {
  const [step, setStep] = useState<"duration" | "guests" | "confirm" | "success">(
    "duration"
  );
  const [duration, setDuration] = useState<number | null>(initialDuration ?? null);
  const [guests, setGuests] = useState<number | null>(initialGuests ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slotsByTime = useMemo(() => {
    const map = new Map<string, ScheduleSlot>();
    for (const s of slots) map.set(s.time, s);
    return map;
  }, [slots]);

  const validDurations = useMemo(() => {
    return ALLOWED_DURATIONS_MINUTES.map((d) => {
      const end = computeEndTime(startTime, d);
      let fits = true;
      let cursor = startTime;
      while (cursor < end) {
        const slot = slotsByTime.get(cursor);
        if (!slot || slot.status !== "available") {
          fits = false;
          break;
        }
        cursor = computeEndTime(cursor, 30);
      }
      const withinAllowance = allowance.remainingMinutes >= d;
      return { duration: d, end, available: fits && withinAllowance };
    });
  }, [startTime, slotsByTime, allowance.remainingMinutes]);

  async function handleConfirm() {
    if (!duration || !guests) return;
    setSubmitting(true);
    setError(null);
    const err = await onSubmit(duration, guests);
    setSubmitting(false);
    if (err) {
      setError(err);
      return;
    }
    setStep("success");
  }

  const endTime = duration ? computeEndTime(startTime, duration) : null;

  return (
    <div className="rounded-2xl border border-forest/30 bg-card p-6 shadow-sm">
      {step !== "success" && (
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg italic text-ink">
            {startTime} on {formatDisplayDate(date)}
          </p>
          <button
            onClick={onCancel}
            className="text-xs font-semibold uppercase tracking-widest text-ink-soft hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}

      {step === "duration" && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Select duration
          </p>
          <div className="grid grid-cols-2 gap-3">
            {validDurations.map((d) => (
              <button
                key={d.duration}
                disabled={!d.available}
                onClick={() => setDuration(d.duration)}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                  duration === d.duration
                    ? "border-forest bg-forest text-stone"
                    : d.available
                    ? "border-line bg-stone hover:border-forest"
                    : "border-line/50 bg-stone-dim text-ink-soft/40 cursor-not-allowed"
                }`}
              >
                {formatMinutesLabel(d.duration)}
                <span className="block text-[11px] font-normal opacity-80">
                  {startTime}–{d.end}
                </span>
              </button>
            ))}
          </div>
          {allowance.remainingMinutes <= 0 && (
            <p className="rounded-xl bg-clay/10 px-4 py-2.5 text-sm text-clay">
              Daily sauna allowance reached.
            </p>
          )}
          {allowance.remainingMinutes > 0 && allowance.remainingMinutes < 120 && (
            <p className="text-xs text-ink-soft">
              {formatMinutesLabel(allowance.remainingMinutes)} remaining today for{" "}
              {apartmentName}.
            </p>
          )}
          <Button
            className="w-full"
            disabled={!duration}
            onClick={() => setStep("guests")}
          >
            Continue
          </Button>
        </div>
      )}

      {step === "guests" && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            How many guests will use the sauna?
          </p>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((g) => (
              <button
                key={g}
                onClick={() => setGuests(g)}
                className={`rounded-xl border py-3 text-lg font-semibold transition-colors ${
                  guests === g
                    ? "border-forest bg-forest text-stone"
                    : "border-line bg-stone hover:border-forest"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setStep("duration")}>
              Back
            </Button>
            <Button className="flex-1" disabled={!guests} onClick={() => setStep("confirm")}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && duration && guests && endTime && (
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Sauna Reservation
          </p>
          <div className="rounded-xl bg-stone p-4 text-sm">
            <dl className="space-y-1.5">
              {surname && (
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Guest</dt>
                  <dd className="font-semibold text-ink">{surname}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-ink-soft">Apartment</dt>
                <dd className="font-semibold text-ink">{apartmentName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Date</dt>
                <dd className="font-semibold text-ink">{formatDisplayDate(date)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Time</dt>
                <dd className="font-semibold text-ink">
                  {startTime} – {endTime}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Duration</dt>
                <dd className="font-semibold text-ink">{formatMinutesLabel(duration)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-soft">Guests</dt>
                <dd className="font-semibold text-ink">{guests}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-xl border border-line px-4 py-3 text-xs text-ink-soft">
            Daily sauna allowance used:{" "}
            <span className="font-semibold text-ink">
              {formatMinutesLabel(allowance.usedMinutes + duration)} / 2h
            </span>
          </div>

          {error && (
            <p className="rounded-xl bg-clay/10 px-4 py-2.5 text-sm text-clay">{error}</p>
          )}

          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={submitting}
              onClick={() => setStep("guests")}
            >
              Back
            </Button>
            <Button className="flex-1" disabled={submitting} onClick={handleConfirm}>
              {submitting ? "Confirming…" : "Confirm Reservation"}
            </Button>
          </div>
        </div>
      )}

      {step === "success" && duration && endTime && (
        <div className="space-y-4 text-center">
          <p className="font-display text-xl italic text-forest">
            Your sauna reservation is confirmed.
          </p>
          <div className="rounded-xl bg-available p-4 text-sm">
            <p className="font-semibold text-ink">{apartmentName}</p>
            <p className="text-ink-soft">{formatDisplayDate(date)}</p>
            <p className="text-ink-soft">
              {startTime} – {endTime}
            </p>
            <p className="text-ink-soft">{guests} guest(s)</p>
          </div>
          <Button className="w-full" onClick={onCancel}>
            Done
          </Button>
        </div>
      )}
    </div>
  );
}
