"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { startEntryAction, stopEntryAction, setPoaAction } from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import type { Domain, TimeEntry } from "@/lib/db";

type ActiveEntry = (TimeEntry & { domain_name: string }) | null;

const POA_FRR_DOMAINS = ["Builder", "Learner"];

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
  const [frrOn, setFrrOn] = useState(false);
  const [poaText, setPoaText] = useState("");

  const [awaitingPoa, setAwaitingPoa] = useState<{
    entryId: number;
    domainName: string;
    domainColor: string;
  } | null>(null);

  function handleSubmitPoa(poaValue: string | null) {
    if (!awaitingPoa) return;
    const target = awaitingPoa;
    startTransition(async () => {
      await setPoaAction(target.entryId, poaValue);
      setAwaitingPoa(null);
      setPoaText("");
    });
  }
  

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
        const eligible = POA_FRR_DOMAINS.includes(domain.name);
        const stopped = await stopEntryAction(
          active.id,
          description,
          eligible ? (frrOn ? 1 : 0) : null
        );
        setTodayTotals((prev) => ({
          ...prev,
          [domain.id]: (prev[domain.id] ?? 0) + (stopped.duration_seconds ?? 0),
        }));
        setActive(null);
        setDescription("");
        setFrrOn(false);
        if (eligible) {
          setAwaitingPoa({
            entryId: stopped.id,
            domainName: domain.name,
            domainColor: domain.color,
          });
        }
      } else {
        if (active) {
          const prevDomain = domains.find((d) => d.id === active.domain_id);
          const prevEligible = prevDomain
            ? POA_FRR_DOMAINS.includes(prevDomain.name)
            : false;
          const stopped = await stopEntryAction(
            active.id,
            description,
            prevEligible ? (frrOn ? 1 : 0) : null
          );
          setTodayTotals((prev) => ({
            ...prev,
            [active.domain_id]:
              (prev[active.domain_id] ?? 0) + (stopped.duration_seconds ?? 0),
          }));
          setDescription("");
          setFrrOn(false);
          if (prevEligible && prevDomain) {
            setAwaitingPoa({
              entryId: stopped.id,
              domainName: prevDomain.name,
              domainColor: prevDomain.color,
            });
          }
        }
        const entry = await startEntryAction(domain.id);
        setActive({ ...entry, domain_name: domain.name });
      }
    });
  }

  function handlePoa(value: number) {
    if (!awaitingPoa) return;
    const target = awaitingPoa;
    startTransition(async () => {
      await setPoaAction(target.entryId, value);
      setAwaitingPoa(null);
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

        {/* Note input field and FRR toggle while tracking */}
        {active && (
          <div className="mt-6 max-w-md mx-auto space-y-3">
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`What are you working on in ${active.domain_name}?`}
              className="w-full px-4 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
            />

            {POA_FRR_DOMAINS.includes(activeDomain?.name ?? "") && (
              <button
                type="button"
                onClick={() => setFrrOn((v) => !v)}
                className={`px-4 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                  frrOn
                    ? "bg-amber-400/20 border-amber-400 text-amber-600"
                    : "border-border text-fg-muted hover:bg-surface-hover"
                }`}
              >
                FRR {frrOn ? "✓" : ""}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Proof of Artifact Post-Mortem Card */}
{awaitingPoa && (
  <div
    className="max-w-md mx-auto rounded-lg border px-5 py-4 bg-surface space-y-3"
    style={{ borderColor: awaitingPoa.domainColor }}
  >
    <div className="text-sm text-fg-muted">
      Proof of Artifact — what did this{" "}
      <span className="text-fg font-medium">{awaitingPoa.domainName}</span>{" "}
      session produce?
    </div>

    <input
      type="text"
      value={poaText}
      onChange={(e) => setPoaText(e.target.value)}
      placeholder="Paste PR link, commit message, output notes..."
      className="w-full px-4 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
    />

    <div className="flex justify-end gap-2">
      <button
        onClick={() => handleSubmitPoa(null)}
        disabled={isPending}
        className="px-3 py-1.5 rounded-md text-xs text-fg-muted hover:text-fg transition-colors"
      >
        Skip
      </button>
      <button
        onClick={() => handleSubmitPoa(poaText)}
        disabled={isPending || !poaText.trim()}
        className="px-4 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium transition-colors disabled:opacity-50"
      >
        Save Proof
      </button>
    </div>
  </div>
)}

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