"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  startEntryAction,
  stopEntryAction,
  setPoaAction,
  setFlowMetaAction,
} from "@/lib/actions";
import { formatDuration, END_REASON_META, FLOW_SHADES } from "@/lib/format";
import type { Domain, TimeEntry, EndReason } from "@/lib/db";

const END_REASON_ORDER: EndReason[] = [
  "natural_completion",
  "blocker",
  "switched_early",
  "sleep",
  "forced_stop",
];

type ActiveEntry = (TimeEntry & { domain_name: string }) | null;

const POA_FRR_DOMAINS = ["Builder", "Learner"];

type WrapupStep = "poa" | "flow";
type Wrapup = {
  entryId: number;
  domainName: string;
  domainColor: string;
  poaEligible: boolean;
  step: WrapupStep;
};

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

  // Single sequential wrap-up flow: POA step (if eligible) -> flow step -> gone.
  const [wrapup, setWrapup] = useState<Wrapup | null>(null);
  const [pendingEndReason, setPendingEndReason] = useState<EndReason | null>(
    null
  );
  const [pendingFlowRating, setPendingFlowRating] = useState(0);

  function startWrapup(entryId: number, domainName: string, domainColor: string) {
    const poaEligible = POA_FRR_DOMAINS.includes(domainName);
    setWrapup({
      entryId,
      domainName,
      domainColor,
      poaEligible,
      step: poaEligible ? "poa" : "flow",
    });
    setPoaText("");
    setPendingEndReason(null);
    setPendingFlowRating(0);
  }

  function handlePoaStepDone(poaValue: string | null) {
    if (!wrapup) return;
    const target = wrapup;
    startTransition(async () => {
      await setPoaAction(target.entryId, poaValue);
      setPoaText("");
      setWrapup({ ...target, step: "flow" });
    });
  }

  function handleFlowStepDone(save: boolean) {
    if (!wrapup) return;
    const target = wrapup;
    const reason = save ? pendingEndReason : null;
    const rating = save ? pendingFlowRating : null;
    startTransition(async () => {
      await setFlowMetaAction(target.entryId, reason, rating);
      setWrapup(null);
      setPendingEndReason(null);
      setPendingFlowRating(0);
    });
  }

  function handleFlowTap() {
    setPendingFlowRating((prev) => (prev + 1) % 4);
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
        startWrapup(stopped.id, domain.name, domain.color);
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
          if (prevDomain) {
            startWrapup(stopped.id, prevDomain.name, prevDomain.color);
          }
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

      {/* Session wrap-up: one step at a time, save/skip advances the arrow, cleans up when done */}
      {wrapup && (
        <div
          className="max-w-md mx-auto rounded-lg border px-5 py-4 bg-surface space-y-3"
          style={{ borderColor: wrapup.domainColor }}
        >
          <div className="flex items-center justify-between text-xs text-fg-faint">
            <span>
              {wrapup.step === "poa" ? "1" : wrapup.poaEligible ? "2" : "1"} of{" "}
              {wrapup.poaEligible ? "2" : "1"}
            </span>
            {wrapup.step === "poa" && wrapup.poaEligible && (
              <span>next: flow →</span>
            )}
          </div>

          {wrapup.step === "poa" && (
            <>
              <div className="text-sm text-fg-muted">
                Proof of Artifact — what did this{" "}
                <span className="text-fg font-medium">{wrapup.domainName}</span>{" "}
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
                  onClick={() => handlePoaStepDone(null)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-md text-xs text-fg-muted hover:text-fg transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => handlePoaStepDone(poaText)}
                  disabled={isPending || !poaText.trim()}
                  className="px-4 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Save & next →
                </button>
              </div>
            </>
          )}

          {wrapup.step === "flow" && (
            <>
              <div className="text-sm text-fg-muted">
                How did that{" "}
                <span className="text-fg font-medium">{wrapup.domainName}</span>{" "}
                session end?
              </div>

              <div className="flex flex-wrap gap-2">
                {END_REASON_ORDER.map((reason) => {
                  const meta = END_REASON_META[reason];
                  const selected = pendingEndReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setPendingEndReason(reason)}
                      title={meta.label}
                      className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        selected
                          ? "bg-fg text-surface border-fg"
                          : "border-border text-fg-muted hover:bg-surface-hover"
                      }`}
                    >
                      {meta.emoji} {meta.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-fg-muted">flow (tap to intensify):</span>
                <button
                  type="button"
                  onClick={handleFlowTap}
                  title={`${pendingFlowRating}/3 — tap to increase`}
                  style={{
                    background: FLOW_SHADES[pendingFlowRating].bg,
                    color: FLOW_SHADES[pendingFlowRating].fg,
                  }}
                  className="h-8 px-4 rounded-full text-xs font-semibold transition-colors"
                >
                  {pendingFlowRating}/3
                </button>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleFlowStepDone(false)}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-md text-xs text-fg-muted hover:text-fg transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={() => handleFlowStepDone(true)}
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </>
          )}
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