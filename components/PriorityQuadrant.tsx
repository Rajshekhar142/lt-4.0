"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getPriorityQuadrantAction,
  getPrimeFocusAction,
  setPrimeFocusAction,
} from "@/lib/actions";
import { formatDuration } from "@/lib/format";
import type { PriorityQuadrantGroup } from "@/lib/db";

const WIDTH = 640;
const HEIGHT = 420;
const PAD = { top: 24, right: 28, bottom: 40, left: 48 };
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

// Color coding based on drill phase/type falls back to friction rating
function getPointColor(key: string, avgFrr: number | null): string {
  const lower = key.toLowerCase();
  if (lower.includes("phase1")) return "#38bdf8"; // sky blue
  if (lower.includes("phase2")) return "#34d399"; // emerald
  if (lower.includes("phase3")) return "#fbbf24"; // amber
  if (lower.includes("phase4")) return "#f87171"; // rose
  if (lower.includes("drill") || lower.includes("speed")) return "#c084fc"; // purple

  if (avgFrr === null) return "#6c8ae4";
  const t = Math.max(0, Math.min(1, avgFrr));
  const from = { r: 0x6c, g: 0x8a, b: 0xe4 };
  const to = { r: 0xff, g: 0x85, b: 0x52 };
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
  const [dayRange, setDayRange] = useState<number>(14);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPriorityQuadrantAction(dayRange).then(setGroups);
  }, [dayRange]);

  useEffect(() => {
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
      return { points: [], xMedian: 0, yMedian: 0.5, xMax: 1 };
    }

    const xs = groups.map((g) => g.total_seconds);
    const ys = groups.map((g) => g.quality_score);
    const xMax = Math.max(...xs, 1);
    const sqrtMax = Math.sqrt(xMax);

    const points = groups.map((g) => {
      // Sqrt transform stretches lower 20-90m drill clusters across the X-axis
      const xRatio = Math.sqrt(Math.max(g.total_seconds, 0)) / sqrtMax;
      const x = PAD.left + Math.min(Math.max(xRatio, 0), 1) * PLOT_W;
      const y = PAD.top + PLOT_H - Math.min(Math.max(g.quality_score, 0), 1) * PLOT_H;

      // Small pinpoint scatter dots (4px - 7px)
      const r = 4 + Math.min(Math.max(g.session_count / 10, 0), 3);

      return {
        ...g,
        x,
        y,
        r,
        color: getPointColor(g.key, g.avg_frr),
      };
    });

    return { points, xMedian: median(xs), yMedian: median(ys), xMax };
  }, [groups]);

  // Sqrt-scaled median split line for X
  const xMedianPx =
    xMax > 0
      ? PAD.left + (Math.sqrt(xMedian) / Math.sqrt(xMax)) * PLOT_W
      : PAD.left + PLOT_W / 2;
  const yMedianPx = PAD.top + PLOT_H - yMedian * PLOT_H;
  const hoveredPoint = points.find((p) => p.key === hovered) ?? null;

  return (
    <div className="mb-10 pb-8 border-b border-border">
      <div className="flex items-start justify-between mb-2 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-medium text-fg">Topic priority quadrant</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            Time invested vs. accuracy — hover any node for breakdown
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 text-xs">
          {[7, 14, 30].map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setDayRange(days)}
              className={`px-2.5 py-1 rounded transition-colors ${
                dayRange === days
                  ? "bg-surface-hover text-fg font-medium border border-border"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Scatter Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] text-fg-faint mb-4 mt-1">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#38bdf8" }} /> p1
          <span className="h-2 w-2 rounded-full" style={{ background: "#34d399" }} /> p2
          <span className="h-2 w-2 rounded-full" style={{ background: "#fbbf24" }} /> p3
          <span className="h-2 w-2 rounded-full" style={{ background: "#f87171" }} /> p4
          <span className="h-2 w-2 rounded-full" style={{ background: "#c084fc" }} /> quicks
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "#6c8ae4" }} /> low friction
          <span className="h-2 w-2 rounded-full" style={{ background: "#ff8552" }} /> high friction
        </span>
      </div>

      {/* Focus input */}
      <div className="mb-5 max-w-md">
        <label className="text-xs text-fg-faint block mb-1.5">
          prime focus (what you intend to prioritize)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={primeFocus}
            onChange={(e) => setPrimeFocus(e.target.value)}
            placeholder="e.g. DILR/circular-arrangement"
            className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-fg focus:outline-none focus:ring-1 focus:ring-fg-muted transition-colors"
          />
          <button
            onClick={handleSaveFocus}
            disabled={isPending || primeFocus === (savedFocus ?? "")}
            className="px-3 py-1.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-xs font-medium transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>

      {!groups ? (
        <p className="text-sm text-fg-faint">Loading quadrant data…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-fg-faint">
          No completed sessions recorded in the last {dayRange} days.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="max-w-full select-none"
          >
            {/* Quadrant background tints */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={Math.max(0, xMedianPx - PAD.left)}
              height={Math.max(0, yMedianPx - PAD.top)}
              fill="rgba(108, 138, 228, 0.03)"
            />
            <rect
              x={xMedianPx}
              y={yMedianPx}
              width={Math.max(0, PAD.left + PLOT_W - xMedianPx)}
              height={Math.max(0, PAD.top + PLOT_H - yMedianPx)}
              fill="rgba(255, 133, 82, 0.03)"
            />

            {/* Axes */}
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

            {/* Median split lines */}
            <line
              x1={xMedianPx}
              y1={PAD.top}
              x2={xMedianPx}
              y2={PAD.top + PLOT_H}
              stroke="var(--fg-faint)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />
            <line
              x1={PAD.left}
              y1={yMedianPx}
              x2={PAD.left + PLOT_W}
              y2={yMedianPx}
              stroke="var(--fg-faint)"
              strokeDasharray="3 3"
              strokeOpacity={0.6}
            />

            {/* Quadrant watermark labels */}
            <text
              x={PAD.left + PLOT_W - 6}
              y={PAD.top + 14}
              textAnchor="end"
              className="fill-fg-faint text-[9px] tracking-wide uppercase"
            >
              converted
            </text>
            <text
              x={PAD.left + 6}
              y={PAD.top + 14}
              textAnchor="start"
              className="fill-fg-faint text-[9px] tracking-wide uppercase"
            >
              efficient
            </text>
            <text
              x={PAD.left + PLOT_W - 6}
              y={PAD.top + PLOT_H - 8}
              textAnchor="end"
              className="fill-amber-500/80 text-[9px] tracking-wide uppercase"
            >
              time sink
            </text>
            <text
              x={PAD.left + 6}
              y={PAD.top + PLOT_H - 8}
              textAnchor="start"
              className="fill-fg-faint text-[9px] tracking-wide uppercase"
            >
              low exposure / drill quicks
            </text>

            {/* Axis titles */}
            <text
              x={PAD.left + PLOT_W / 2}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="fill-fg-muted text-[11px] font-medium"
            >
              time invested (spread scale) →
            </text>
            <text
              x={14}
              y={PAD.top + PLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
              className="fill-fg-muted text-[11px] font-medium"
            >
              accuracy / quality ↑
            </text>

            {/* Scatter nodes */}
            {points.map((p) => {
              const isSelected = hovered === p.key;
              const dimmed = hovered !== null && !isSelected;

              return (
                <g
                  key={p.key}
                  onMouseEnter={() => setHovered(p.key)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isSelected ? p.r + 3 : p.r}
                    fill={p.color}
                    fillOpacity={dimmed ? 0.2 : 0.9}
                    stroke="var(--surface)"
                    strokeWidth={isSelected ? 2 : 1}
                  />
                </g>
              );
            })}
          </svg>

          {/* Reserved Detail Slot */}
          <div className="mt-3 min-h-[96px]">
            {hoveredPoint ? (
              <div className="p-3 bg-surface rounded-md border border-border text-xs max-w-md shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: hoveredPoint.color }}
                    />
                    <span className="font-semibold text-fg text-sm">{hoveredPoint.key}</span>
                  </div>
                  <span className="text-fg-muted font-mono">
                    {formatDuration(hoveredPoint.total_seconds)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-fg-muted pt-1.5">
                  <div>
                    Sessions: <span className="text-fg font-medium">{hoveredPoint.session_count}</span>
                  </div>
                  <div>
                    Score:{" "}
                    <span className="text-fg font-medium">
                      {(hoveredPoint.quality_score * 100).toFixed(0)}%
                    </span>
                  </div>

                  {hoveredPoint.attempted_total > 0 ? (
                    <>
                      <div>
                        Accuracy:{" "}
                        <span className="text-fg font-medium">
                          {((hoveredPoint.correct_total / hoveredPoint.attempted_total) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        Ratio:{" "}
                        <span className="text-fg font-medium">
                          {hoveredPoint.correct_total}/{hoveredPoint.attempted_total}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 text-fg-faint italic">
                      Time drill / speed session (scored on completion & flow)
                    </div>
                  )}

                  {hoveredPoint.avg_flow_rating !== null && (
                    <div>
                      Flow: <span className="text-fg font-medium">{hoveredPoint.avg_flow_rating.toFixed(1)}/3</span>
                    </div>
                  )}
                  {hoveredPoint.avg_frr !== null && (
                    <div>
                      FRR: <span className="text-fg font-medium">{(hoveredPoint.avg_frr * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-faint italic pt-2">
                Hover any pinpoint node to view drill phase, duration, and score breakdown.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}