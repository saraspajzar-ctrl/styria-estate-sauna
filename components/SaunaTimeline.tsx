"use client";

import { ScheduleSlot } from "@/lib/types";

type GuestInfoSlot = ScheduleSlot & { guestSurname?: string };

type Row =
  | { kind: "available"; time: string; disabled: boolean; isPreview: boolean }
  | { kind: "closed"; time: string }
  | {
      kind: "reserved";
      time: string;
      span: number;
      apartmentName: string;
      guestSurname?: string;
      isMine: boolean;
    };

function groupRows(
  slots: GuestInfoSlot[],
  previewTimes: Set<string>,
  disabledTimes: Set<string>
): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (slot.status === "reserved") {
      if (slot.isReservationStart) {
        let span = 1;
        let j = i + 1;
        while (j < slots.length && slots[j].reservationId === slot.reservationId) {
          span++;
          j++;
        }
        rows.push({
          kind: "reserved",
          time: slot.time,
          span,
          apartmentName: slot.apartmentName ?? "Reserved",
          guestSurname: slot.guestSurname,
          isMine: !!slot.isMine,
        });
      }
      continue;
    }
    if (slot.status === "closed") {
      rows.push({ kind: "closed", time: slot.time });
      continue;
    }
    rows.push({
      kind: "available",
      time: slot.time,
      disabled: disabledTimes.has(slot.time),
      isPreview: previewTimes.has(slot.time),
    });
  }
  return rows;
}

export function SaunaTimeline({
  slots,
  previewTimes = new Set(),
  disabledTimes = new Set(),
  onSelectTime,
}: {
  slots: GuestInfoSlot[];
  previewTimes?: Set<string>;
  disabledTimes?: Set<string>;
  onSelectTime?: (time: string) => void;
}) {
  const rows = groupRows(slots, previewTimes, disabledTimes);

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        <span>Time</span>
        <span>Sauna</span>
      </div>
      <div className="divide-y divide-line/70">
        {rows.map((row) => {
          if (row.kind === "closed") {
            return (
              <div
                key={row.time}
                className="flex items-center justify-between px-5 py-2.5 text-sm text-ink-soft/50"
              >
                <span className="font-mono">{row.time}</span>
                <span className="tracking-widest text-[11px] uppercase">Closed</span>
              </div>
            );
          }
          if (row.kind === "available") {
            const clickable = !!onSelectTime && !row.disabled;
            return (
              <button
                key={row.time}
                type="button"
                disabled={!clickable}
                onClick={() => onSelectTime?.(row.time)}
                className={`flex w-full items-center justify-between px-5 py-2.5 text-sm transition-colors ${
                  row.isPreview
                    ? "bg-sage/30"
                    : clickable
                    ? "hover:bg-available cursor-pointer"
                    : row.disabled
                    ? "opacity-30 cursor-not-allowed"
                    : ""
                }`}
              >
                <span className="font-mono text-ink">{row.time}</span>
                <span
                  className={`rounded-full px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${
                    row.isPreview
                      ? "bg-forest text-stone"
                      : "bg-available text-forest-light border border-available-border"
                  }`}
                >
                  {row.isPreview ? "Selected" : "Available"}
                </span>
              </button>
            );
          }
          return (
            <div
              key={row.time}
              className="flex items-stretch justify-between px-5 py-3"
              style={{ minHeight: `${row.span * 2.6}rem` }}
            >
              <span className="font-mono text-sm text-ink-soft pt-0.5">{row.time}</span>
              <div
                className={`flex-1 ml-4 rounded-xl flex flex-col items-center justify-center gap-0.5 py-2 ${
                  row.isMine ? "bg-forest text-stone" : "bg-gold text-ink"
                }`}
              >
                <span className="text-xs font-bold uppercase tracking-widest">
                  {row.apartmentName}
                </span>
                {row.guestSurname && (
                  <span className="text-[11px] opacity-80">{row.guestSurname}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
