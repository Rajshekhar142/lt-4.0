import { formatDuration } from "@/lib/format";
import type { Analytics } from "@/lib/db";

function DeltaBadge({ pct, label }: { pct: number | null; label: string }) {
  if (pct === null) {
    return <span className="text-fg-faint">no {label} data</span>;
  }

  const rounded = Math.round(pct);
  const isUp = rounded > 0;
  const isFlat = rounded === 0;
  const color = isFlat ? "var(--fg-muted)" : isUp ? "#4caf7d" : "#ff8552";
  const arrow = isFlat ? "→" : isUp ? "↑" : "↓";

  return (
    <span style={{ color }}>
      {arrow} {Math.abs(rounded)}% {label}
    </span>
  );
}

export default function AnalyticsSection({ analytics }: { analytics: Analytics }) {
  const hasAnyToday = analytics.today_total > 0;

  return (
    <div className="mb-10 pb-8 border-b border-border">
      <h2 className="text-sm text-fg-muted mb-4">Today vs. your recent pace</h2>

      {!hasAnyToday ? (
        <p className="text-sm text-fg-faint">Nothing tracked today yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="flex items-center gap-4 text-sm">
              <span className="font-mono tabular">
                {formatDuration(analytics.today_total)}
              </span>
              <DeltaBadge
                pct={
                  analytics.yesterday_total > 0
                    ? ((analytics.today_total - analytics.yesterday_total) /
                        analytics.yesterday_total) *
                      100
                    : null
                }
                label="vs yesterday"
              />
              <DeltaBadge
                pct={
                  analytics.trailing_avg_total > 0
                    ? ((analytics.today_total - analytics.trailing_avg_total) /
                        analytics.trailing_avg_total) *
                      100
                    : null
                }
                label="vs 7-day avg"
              />
            </span>
          </div>

          {analytics.domains
            .filter((d) => d.today_seconds > 0)
            .map((d) => (
              <div key={d.domain_id} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ background: d.domain_color }}
                  />
                  {d.domain_name}
                </span>
                <span className="flex items-center gap-4 text-sm">
                  <span className="font-mono tabular text-fg-muted">
                    {formatDuration(d.today_seconds)}
                  </span>
                  <DeltaBadge pct={d.vs_yesterday_pct} label="vs yesterday" />
                  <DeltaBadge pct={d.vs_trailing_avg_pct} label="vs 7-day avg" />
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}