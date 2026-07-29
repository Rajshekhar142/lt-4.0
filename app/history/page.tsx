import { getHistoryAction, getAnalyticsAction } from "@/lib/actions";
import { requireUser } from "@/lib/auth";
import { formatDuration, formatDayLabel } from "@/lib/format";
import AnalyticsSection from "@/components/AnalyticsSection";

export const dynamic = "force-dynamic";

type DayGroup = {
  dateKey: string;
  total: number;
  segments: { name: string; color: string; seconds: number }[];
  entries: {
    id: number;
    domain_name: string;
    domain_color: string;
    description: string | null;
    duration_seconds: number | null;
    frr: number | null;
    poa: string | null;
    started_at: string;
  }[];
};

export default async function HistoryPage() {
  await requireUser();

  const [entries, analytics] = await Promise.all([
    getHistoryAction(30),
    getAnalyticsAction(),
  ]);

  const byDay = new Map<string, DayGroup>();

  for (const e of entries) {
    const dateKey = e.started_at.slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(dateKey)) {
      byDay.set(dateKey, { dateKey, total: 0, segments: [], entries: [] });
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

    group.entries.push({
      id: e.id,
      domain_name: e.domain_name,
      domain_color: e.domain_color,
      description: e.description,
      duration_seconds: e.duration_seconds,
      frr: e.frr,
      poa: e.poa,
      started_at: e.started_at,
    });
  }

  const days = Array.from(byDay.values()).sort((a, b) =>
    b.dateKey.localeCompare(a.dateKey)
  );

  if (days.length === 0) {
    return (
      <div>
        <AnalyticsSection analytics={analytics} />
        <div className="text-center text-fg-muted py-16">
          No sessions logged in the past 30 days yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnalyticsSection analytics={analytics} />
      <h1 className="text-sm text-fg-muted mb-6">Last 30 days</h1>
      {days.map((day) => (
        <details
          key={day.dateKey}
          className="group border-b border-border last:border-b-0"
        >
          <summary className="flex items-center gap-4 py-3 cursor-pointer list-none select-none">
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
          </summary>

          <div className="pl-24 pb-3 space-y-1.5">
            {day.entries.map((entry) => {
              const hasPoa = typeof entry.poa === "string" ? entry.poa.trim().length > 0 : Boolean(entry.poa);
              const isBoth = entry.frr === 1 && hasPoa;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 text-sm py-2 px-3 rounded-md transition-all ${
                    isBoth
                      ? "bg-amber-500/10 border-2 border-amber-400/80 shadow-sm"
                      : hasPoa
                      ? "bg-emerald-400/10 border border-emerald-400/30"
                      : "bg-surface border border-border"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: entry.domain_color }}
                  />
                  <span className="text-fg-muted w-16 shrink-0 font-medium">
                    {entry.domain_name}
                  </span>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="truncate text-fg">
                      {entry.description || "—"}
                    </div>
                    {hasPoa && (
                      <div className="text-xs text-fg-muted truncate">
                        Receipt: <span className="italic">{entry.poa}</span>
                      </div>
                    )}
                  </div>

                  {/* Special Badge when both FRR and Artifact proof exist */}
                  {isBoth ? (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-400/20 text-amber-500 font-bold tracking-wide uppercase shrink-0">
                      ⚡ FRR + Artifact
                    </span>
                  ) : (
                    <>
                      {entry.frr === 1 && (
                        <span className="text-xs text-amber-500 font-medium shrink-0">
                          FRR
                        </span>
                      )}
                      {hasPoa && (
                        <span className="text-xs text-emerald-500 font-medium shrink-0">
                          ✓ artifact
                        </span>
                      )}
                    </>
                  )}

                  <span className="font-mono tabular text-xs text-fg-faint shrink-0">
                    {formatDuration(entry.duration_seconds ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}