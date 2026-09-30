"use client";

import { useEffect, useMemo, useState, useTransition, useRef } from "react";
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
  const [tagText, setTagText] = useState(""); 
  // Single sequential wrap-up flow: POA step (if eligible) -> flow step -> gone.
  const [wrapup, setWrapup] = useState<Wrapup | null>(null);
  const [pendingEndReason, setPendingEndReason] = useState<EndReason | null>(
    null
  );
  const [pendingFlowRating, setPendingFlowRating] = useState(0);


  const [capSeconds, setCapSeconds] = useState<number | null>(null);
  const [capHit, setCapHit] = useState(false);
  const [showCapPicker, setShowCapPicker] = useState(false);
  const [capH, setCapH] = useState(0);
  const [capM, setCapM] = useState(0);
  const [capS, setCapS] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        // ───────── SPOT 1: same-domain stop (toggling off the domain you're already tracking) ─────────
        const eligible = POA_FRR_DOMAINS.includes(domain.name);
        const stopped = await stopEntryAction(
          active.id,
          description,
          eligible ? (frrOn ? 1 : 0) : null,
          tagText   // NEW
        );
        setTodayTotals((prev) => ({
          ...prev,
          [domain.id]: (prev[domain.id] ?? 0) + (stopped.duration_seconds ?? 0),
        }));
        setActive(null);
        setDescription("");
        setFrrOn(false);
        setTagText("");   // NEW
        stopAlarm();
        setCapSeconds(null);
        setCapH(0); setCapM(0); setCapS(0);
        startWrapup(stopped.id, domain.name, domain.color);
        // ───────── end SPOT 1 ─────────
      } else {
        if (active) {
          // ───────── SPOT 2: switching domains (stopping the PREVIOUS domain before starting the new one) ─────────
          const prevDomain = domains.find((d) => d.id === active.domain_id);
          const prevEligible = prevDomain
            ? POA_FRR_DOMAINS.includes(prevDomain.name)
            : false;
          const stopped = await stopEntryAction(
            active.id,
            description,
            prevEligible ? (frrOn ? 1 : 0) : null,
            tagText   // NEW
          );
          setTodayTotals((prev) => ({
            ...prev,
            [active.domain_id]:
              (prev[active.domain_id] ?? 0) + (stopped.duration_seconds ?? 0),
          }));
          setDescription("");
          setFrrOn(false);
          setTagText("");   // NEW
          stopAlarm();
          setCapSeconds(null);
          setCapH(0); setCapM(0); setCapS(0);
          if (prevDomain) {
            startWrapup(stopped.id, prevDomain.name, prevDomain.color);
          }
          // ───────── end SPOT 2 ─────────
        }
        const entry = await startEntryAction(domain.id);
        setActive({ ...entry, domain_name: domain.name });
      }
    });
  }

  function beep() {
  const ctx = audioCtxRef.current;
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = 880;
  osc.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.start();
  osc.stop(ctx.currentTime + 0.3);
}

function triggerAlarm() {
  setCapHit(true);
  if (!audioCtxRef.current) {
    audioCtxRef.current = new AudioContext();
  }
  beep();
  alarmIntervalRef.current = setInterval(beep, 600);
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    new Notification("Time's up", { body: "Cap reached — solving continues, alarm is on you now." });
  }
}

function stopAlarm() {
  if (alarmIntervalRef.current) {
    clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
  }
  if (audioCtxRef.current) {
    audioCtxRef.current.close().catch(() => {});
    audioCtxRef.current = null;
  }
  setCapHit(false);
  setCapSeconds(null);
  setCapH(0);
  setCapM(0);
  setCapS(0);
}

function saveCap() {
  const total = capH * 3600 + capM * 60 + capS;
  if (total > 0) {
    setCapSeconds(total);
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
  setShowCapPicker(false);
}

useEffect(() => {
  document.title = active ? formatDuration(liveElapsed) : "LifeTracker";
}, [active, liveElapsed]);

useEffect(() => {
  if (!capHit) {
    document.title = active ? formatDuration(liveElapsed) : "LifeTracker";
    return;
  }
  const id = setInterval(() => {
    document.title = document.title === "TIME'S UP" ? formatDuration(liveElapsed) : "TIME'S UP";
  }, 700);
  return () => clearInterval(id);
}, [active, liveElapsed, capHit]);


useEffect(() => {
  if (!active || capSeconds === null || capHit) return;
  const started = new Date(active.started_at).getTime();
  const msRemaining = started + capSeconds * 1000 - Date.now();
  if (msRemaining <= 0) {
    triggerAlarm();
    return;
  }
  const id = setTimeout(triggerAlarm, msRemaining);
  return () => clearTimeout(id);
}, [active, capSeconds, capHit]);

useEffect(() => {
  function onVisible() {
    if (document.visibilityState !== "visible" || !active || capSeconds === null || capHit) return;
    const started = new Date(active.started_at).getTime();
    if (Date.now() >= started + capSeconds * 1000) triggerAlarm();
  }
  document.addEventListener("visibilitychange", onVisible);
  return () => document.removeEventListener("visibilitychange", onVisible);
}, [active, capSeconds, capHit]);

  return (
    <div className="space-y-8">
      {/* Hero: Live readout & note input */}
      <div className="text-center py-6">
        <div
          suppressHydrationWarning
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

            <input
            type="text"
            value={tagText}
            onChange={(e) => setTagText(e.target.value)}
            placeholder="tag (e.g. dsa, chess-endgames, eks-setup)"
            className="w-full px-4 py-2 text-sm rounded-md border border-border bg-surface text-fg-muted focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
    />

    {capSeconds === null && !showCapPicker && (
      <button
        type="button"
        onClick={() => setShowCapPicker(true)}
        className="text-xs text-fg-faint hover:text-fg-muted underline underline-offset-2"
      >
        set timer
      </button>
    )}

    {showCapPicker && (
      <div className="flex items-center gap-2 justify-center">
        {[["h", capH, setCapH, 23], ["m", capM, setCapM, 59], ["s", capS, setCapS, 59]].map(
          ([label, val, setter, max]: any) => (
            <div key={label} className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={max}
                value={val}
                onChange={(e) => setter(Math.max(0, Math.min(max, Number(e.target.value))))}
                className="w-14 px-2 py-1 text-sm rounded-md border border-border bg-surface text-fg text-center"
              />
              <span className="text-xs text-fg-faint">{label}</span>
            </div>
          )
        )}
        <button onClick={saveCap} className="px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium">
          Save
        </button>
        <button onClick={() => setShowCapPicker(false)} className="text-xs text-fg-faint hover:text-fg-muted">
          cancel
        </button>
      </div>
    )}

    {capSeconds !== null && (
      <div className={`text-xs ${capHit ? "text-amber-500 font-semibold" : "text-fg-faint"}`}>
        cap: {formatDuration(capSeconds)}{capHit ? " — time's up" : ""}
      </div>
    )}

    {capHit && (
      <div className="flex items-center justify-center gap-3 rounded-md border border-amber-400 bg-amber-400/10 px-4 py-2">
        <span className="text-sm font-medium text-amber-600">⏰ Time's up</span>
        <button
          onClick={stopAlarm}
          className="px-3 py-1 rounded-md bg-amber-400 text-amber-950 text-xs font-semibold"
        >
          Stop alarm
        </button>
      </div>
    )}

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
                <span suppressHydrationWarning className="font-mono tabular text-sm text-fg-muted">
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