"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { startEntryAction, stopEntryAction } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import type { Domain, TimeEntry } from "@/lib/db";

type ActiveEntry = (TimeEntry & { domain_name: string }) | null;

export default function TrackerClient({
  domains,
  initialActiveEntry,
  initialTodayTotals,
}: {
  domains: Domain[];
  initialActiveEntry: ActiveEntry;
  initialTodayTotals: Record<number, number>;
}) {
  const [active, setActive] = useState<ActiveEntry>(initialActiveEntry);
  const [todayTotals, setTodayTotals] = useState(initialTodayTotals);
  const [now, setNow] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState<string>("");

  // Tick every second while a domain is running.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const liveElapsed = useMemo(() => {
    if (!active) return 0;
    const started = new Date(active.started_at).getTime();
    return (now - started) / 1000;
  }, [active, now]);

  const activeDomain = domains.find((d) => d.id === active?.domain_id);

  function handleToggle(domain: Domain) {
    startTransition(async () => {
      if (active && active.domain_id === domain.id) {
        const stopped = await stopEntryAction(active.id, description);
        setTodayTotals((prev) => ({
          ...prev,
          [domain.id]: (prev[domain.id] ?? 0) + (stopped.duration_seconds ?? 0),
        }));
        setActive(null);
        setDescription(""); // Reset note field on stop
      } else {
        if (active) {
          await stopEntryAction(active.id, description);
          setTodayTotals((prev) => ({
            ...prev,
            [active.domain_id]:
              (prev[active.domain_id] ?? 0) + Math.round(liveElapsed),
          }));
          setDescription(""); // Reset note field when switching domain
        }
        const entry = await startEntryAction(domain.id);
        setActive({ ...entry, domain_name: domain.name });
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Hero: Live readout & note input */}
      <div className="text-center py-6">
        <div
          className="font-mono text-6xl sm:text-7xl tabular tracking-tight transition-colors"
          style={{ color: active ? activeDomain?.color : "var(--fg-faint)" }}
        >
          {active ? formatDuration(liveElapsed) : "—:--"}
        </div>
        <div className="mt-3 text-sm text-fg-muted">
          {active ? (
            <>
              tracking <span className="text-fg">{active.domain_name}</span>
            </>
          ) : (
            "nothing running"
          )}
        </div>

        {/* Note input field visible while tracking */}
        {active && (
          <div className="mt-6 max-w-md mx-auto">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`What are you working on in ${active.domain_name}?`}
              className="w-full px-4 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
            />
          </div>
        )}
      </div>

      {/* Domain rows */}
      <div className="space-y-2">
        {domains.map((domain) => {
          const isActive = active?.domain_id === domain.id;
          const total =
            (todayTotals[domain.id] ?? 0) + (isActive ? liveElapsed : 0);

          return (
            <button
              key={domain.id}
              onClick={() => handleToggle(domain)}
              disabled={isPending}
              className={`w-full flex items-center justify-between rounded-lg border px-5 py-4 text-left transition-colors disabled:opacity-60 ${
                isActive
                  ? "bg-surface-hover"
                  : "bg-surface hover:bg-surface-hover"
              }`}
              style={{
                borderColor: isActive ? domain.color : "var(--border)",
              }}
            >
              <span className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: domain.color }}
                />
                <span className="font-medium">{domain.name}</span>
              </span>
              <span className="flex items-center gap-4">
                <span className="font-mono tabular text-sm text-fg-muted">
                  {formatDuration(total)}
                </span>
                <span className="text-xs text-fg-faint w-10 text-right">
                  {isActive ? "stop" : "start"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}