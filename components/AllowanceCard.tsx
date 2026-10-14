import { DailyAllowance } from "@/lib/types";

function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

export function AllowanceCard({
  apartmentName,
  dateLabel,
  allowance,
}: {
  apartmentName: string;
  dateLabel: string;
  allowance: DailyAllowance;
}) {
  const pct = Math.min(100, (allowance.usedMinutes / allowance.limitMinutes) * 100);
  const full = allowance.remainingMinutes <= 0;

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
        My Sauna Allowance
      </p>
      <p className="mt-1 font-display text-lg text-ink">{apartmentName}</p>
      <p className="text-xs text-ink-soft">{dateLabel}</p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-dim">
        <div
          className={`h-full rounded-full transition-all ${full ? "bg-clay" : "bg-forest"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-ink-soft">{formatMinutes(allowance.usedMinutes)} used</span>
        <span className={`font-semibold ${full ? "text-clay" : "text-forest"}`}>
          {full ? "Allowance reached" : `${formatMinutes(allowance.remainingMinutes)} remaining`}
        </span>
      </div>
    </div>
  );
}
