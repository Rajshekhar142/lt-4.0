import { getHistoryAction } from "@/lib/actions";
import { formatDuration, formatDayLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type DayGroup = {
  dateKey: string;
  total: number;
  segments: { name: string; color: string; seconds: number }[];
};

export default async function HistoryPage() {
  const entries = await getHistoryAction(30);

  const byDay = new Map<string, DayGroup>();

  for (const e of entries) {
    const dateKey = e.started_at.slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, { dateKey, total: 0, segments: [] });
    }
    const group = byDay.get(dateKey)!;
    const seconds = e.duration_seconds ?? 0;
    group.total += seconds;

    const existing = group.segments.find((s) => s.name === e.domain_name);
    if (existing) existing.seconds += seconds;
    else
      group.segments.push({
        name: e.domain_name,
        color: e.domain_color,
        seconds,
      });
  }

  const days = Array.from(byDay.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey)
  );

  if (days.length === 0) {
    return (
      <div className="text-center text-fg-muted py-16">
        No sessions logged in the past 30 days yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <h1 className="text-sm text-fg-muted mb-6">Last 30 days</h1>
      {days.map((day) => (
        <div
          key={day.dateKey}
          className="flex items-center gap-4 py-3 border-b border-border last:border-b-0"
        >
          <div className="w-24 shrink-0 text-sm text-fg-muted">
            {formatDayLabel(day.dateKey)}
          </div>

          <div className="flex-1 h-2.5 rounded-full bg-surface overflow-hidden flex">
            {day.segments.map((seg) => (
              <div
                key={seg.name}
                style={{
                  width: `${(seg.seconds / day.total) * 100}%`,
                  background: seg.color,
                }}
                title={`${seg.name}: ${formatDuration(seg.seconds)}`}
              />
            ))}
          </div>

          <div className="w-16 shrink-0 text-right font-mono tabular text-sm text-fg-muted">
            {formatDuration(day.total)}
          </div>
        </div>
      ))}
    </div>
  );
}
