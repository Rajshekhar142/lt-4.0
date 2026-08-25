"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getPriorityQuadrantAction,
  getPrimeFocusAction,
  setPrimeFocusAction,
} from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import type { PriorityQuadrantGroup } from "@/lib/db";

const WIDTH = 560;
const HEIGHT = 420;
const PAD = { top: 20, right: 24, bottom: 40, left: 44 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// avg_frr is a 0-1 fraction (frr stored as 0/1 per session) — interpolate
// from the Learner blue (low friction) to an amber/orange (high friction).
function frrColor(avgFrr: number | null): string {
  if (avgFrr === null) return "#6c8ae4";
  const t = Math.max(0, Math.min(1, avgFrr));
  const from = { r: 0x6c, g: 0x8a, b: 0xe4 }; // #6c8ae4
  const to = { r: 0xff, g: 0x85, b: 0x52 }; // #ff8552
  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function PriorityQuadrant() {
  const [groups, setGroups] = useState<PriorityQuadrantGroup[] | null>(null);
  const [primeFocus, setPrimeFocus] = useState("");
  const [savedFocus, setSavedFocus] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPriorityQuadrantAction(30).then(setGroups);
    getPrimeFocusAction().then((v) => {
      setPrimeFocus(v ?? "");
      setSavedFocus(v);
    });
  }, []);

  function handleSaveFocus() {
    startTransition(async () => {
      const saved = await setPrimeFocusAction(primeFocus);
      setSavedFocus(saved);
    });
  }

  const { points, xMedian, yMedian, xMax } = useMemo(() => {
    if (!groups || groups.length === 0) {
      return { points: [], xMedian: 0, yMedian: 0, xMax: 1 };
    }
    const xs = groups.map((g) => g.total_seconds);
    const ys = groups.map((g) => g.quality_score);
    const xMax = Math.max(...xs, 1);
    const maxCount = Math.max(...groups.map((g) => g.session_count), 1);

    const points = groups.map((g) => ({
      ...g,
      x: PAD.left + (g.total_seconds / xMax) * PLOT_W,
      y: PAD.top + PLOT_H - (g.quality_score / 1) * PLOT_H,
      r: 5 + (g.session_count / maxCount) * 14,
    }));

    return {
      points,
      xMedian: median(xs),
      yMedian: median(ys),
      xMax,
    };
  }, [groups]);

  const xMedianPx = PAD.left + (xMedian / xMax) * PLOT_W;
  const yMedianPx = PAD.top + PLOT_H - yMedian * PLOT_H;

  return (
    <div className="mb-10 pb-8 border-b border-border">
      <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
        <h2 className="text-sm text-fg-muted">Priority quadrant — last 30 days</h2>
      </div>

      {/* Prime focus field — stated intent, sitting right next to the revealed one */}
      <div className="mb-6 max-w-md">
        <label className="text-xs text-fg-faint block mb-1.5">
          prime focus (what you intend to prioritize)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={primeFocus}
            onChange={(e) => setPrimeFocus(e.target.value)}
            placeholder="e.g. EKS migration"
            className="flex-1 px-4 py-2 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
          />
          <button
            onClick={handleSaveFocus}
            disabled={isPending || primeFocus === (savedFocus ?? "")}
            className="px-4 py-2 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {!groups ? (
        <p className="text-sm text-fg-faint">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-fg-faint">
          No completed sessions in the last 30 days yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="max-w-full"
          >
            {/* axes */}
            <line
              x1={PAD.left}
              y1={PAD.top + PLOT_H}
              x2={PAD.left + PLOT_W}
              y2={PAD.top + PLOT_H}
              stroke="var(--border)"
            />
            <line
              x1={PAD.left}
              y1={PAD.top}
              x2={PAD.left}
              y2={PAD.top + PLOT_H}
              stroke="var(--border)"
            />

            {/* median-split crosshair */}
            <line
              x1={xMedianPx}
              y1={PAD.top}
              x2={xMedianPx}
              y2={PAD.top + PLOT_H}
              stroke="var(--fg-faint)"
              strokeDasharray="4 4"
            />
            <line
              x1={PAD.left}
              y1={yMedianPx}
              x2={PAD.left + PLOT_W}
              y2={yMedianPx}
              stroke="var(--fg-faint)"
              strokeDasharray="4 4"
            />

            {/* quadrant labels */}
            <text x={PAD.left + PLOT_W - 4} y={PAD.top + 14} textAnchor="end" className="fill-fg-faint text-[10px]">
              real priorities
            </text>
            <text x={PAD.left + 4} y={PAD.top + 14} textAnchor="start" className="fill-fg-faint text-[10px]">
              deserves more time
            </text>
            <text x={PAD.left + PLOT_W - 4} y={PAD.top + PLOT_H - 6} textAnchor="end" className="fill-fg-faint text-[10px]">
              grind / burnout
            </text>
            <text x={PAD.left + 4} y={PAD.top + PLOT_H - 6} textAnchor="start" className="fill-fg-faint text-[10px]">
              drop candidates
            </text>

            {/* axis labels */}
            <text
              x={PAD.left + PLOT_W / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-fg-muted text-[11px]"
            >
              time invested →
            </text>
            <text
              x={14}
              y={PAD.top + PLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
              className="fill-fg-muted text-[11px]"
            >
              quality ↑
            </text>

            {/* points */}
            {points.map((p) => (
              <g
                key={p.key}
                onMouseEnter={() => setHovered(p.key)}
                onMouseLeave={() => setHovered(null)}
              >
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.r}
                  fill={frrColor(p.avg_frr)}
                  fillOpacity={hovered === null || hovered === p.key ? 0.75 : 0.25}
                  stroke="var(--surface)"
                  strokeWidth={1.5}
                />
                <text
                  x={p.x}
                  y={p.y - p.r - 5}
                  textAnchor="middle"
                  className="fill-fg text-[10px]"
                  opacity={hovered === null || hovered === p.key ? 1 : 0.25}
                >
                  {p.key}
                </text>
              </g>
            ))}
          </svg>

          {hovered && (
            <div className="mt-2 text-xs text-fg-muted">
              {(() => {
                const g = points.find((p) => p.key === hovered)!;
                return (
                  <>
                    <span className="text-fg font-medium">{g.key}</span> —{" "}
                    {formatDuration(g.total_seconds)} across {g.session_count}{" "}
                    session{g.session_count === 1 ? "" : "s"}, quality{" "}
                    {(g.quality_score * 100).toFixed(0)}%
                    {g.avg_frr !== null && <>, avg FRR {(g.avg_frr * 100).toFixed(0)}%</>}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
