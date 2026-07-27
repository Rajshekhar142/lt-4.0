import { getHistoryAction } from "@/lib/actions";
import { formatDuration, formatDayLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

type DayGroup = {
  dateKey: string;
  total: number;
  segments: { name: string; color: string; seconds: number }[];
  entries: {
    id: number;
    domain_name: string;
    domain_color: string;
    duration_seconds: number | null;
    description?: string | null;
  }[];
};

export default async function HistoryPage() {
  const entries = await getHistoryAction(30);

  const byDay = new Map<string, DayGroup>();

  for (const e of entries) {
    const dateKey = e.started_at.slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, { dateKey, total: 0, segments: [], entries: [] });
    }
    const group = byDay.get(dateKey)!;
    const seconds = e.duration_seconds ?? 0;
    group.total += seconds;

    // Save individual entry for description rendering
    group.entries.push(e);

    // Aggregate segments for progress bar
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
    <div className="space-y-8">
      <h1 className="text-sm text-fg-muted mb-6">Last 30 days</h1>
      {days.map((day) => (
        <div key={day.dateKey} className="space-y-3 pb-6 border-b border-border last:border-b-0">
          {/* Day overview row */}
          <div className="flex items-center gap-4">
            <div className="w-24 shrink-0 text-sm font-medium text-fg">
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

          {/* Detailed entries list with descriptions */}
          <div className="pl-4 space-y-2">
            {day.entries.map((entry) => (
              <div key={entry.id} className="text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: entry.domain_color }}
                  />
                  <span className="font-medium text-fg">{entry.domain_name}</span>
                  <span className="font-mono text-fg-muted">
                    ({formatDuration(entry.duration_seconds ?? 0)})
                  </span>
                </div>
                {entry.description && (
                  <p className="text-xs text-fg-muted italic pl-4 border-l border-border">
                    {entry.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}