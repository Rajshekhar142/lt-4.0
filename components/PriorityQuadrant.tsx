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
const HEIGHT = 460;
const PAD = { top: 24, right: 32, bottom: 48, left: 52 };
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

// Color scale interpolating between low friction blue and high friction orange
function frrColor(avgFrr: number | null): string {
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
      return { points: [], xMedian: 0, yMedian: 0.5, xMax: 1 };
    }

    const xs = groups.map((g) => g.total_seconds);
    const ys = groups.map((g) => g.quality_score);
    const xMax = Math.max(...xs, 1);
    const maxCount = Math.max(...groups.map((g) => g.session_count), 1);

    const points = groups.map((g) => ({
      ...g,
      x: PAD.left + (g.total_seconds / xMax) * PLOT_W,
      // Invert Y: 0 is at bottom (PAD.top + PLOT_H), 1 is at top (PAD.top)
      y: PAD.top + PLOT_H - g.quality_score * PLOT_H,
      r: Math.max(5, Math.min(22, 5 + (g.session_count / maxCount) * 15)),
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
        <div>
          <h2 className="text-sm font-medium text-fg">Topic Priority & Accuracy Quadrant</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            Tracking time vs. accuracy conversion over the last 30 days
          </p>
        </div>
      </div>

      <div className="mb-6 max-w-md">
        <label className="text-xs text-fg-faint block mb-1.5">
          prime focus (what you intend to prioritize)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={primeFocus}
            onChange={(e) => setPrimeFocus(e.target.value)}
            placeholder="e.g. DILR - Circular Arrangement"
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
          No completed sessions recorded in the last 30 days.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <svg
            width={WIDTH}
            height={HEIGHT}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="max-w-full select-none"
          >
            {/* Background Grid Quadrant Tints */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={xMedianPx - PAD.left}
              height={yMedianPx - PAD.top}
              fill="rgba(108, 138, 228, 0.03)"
            />
            <rect
              x={xMedianPx}
              y={yMedianPx}
              width={PAD.left + PLOT_W - xMedianPx}
              height={PAD.top + PLOT_H - yMedianPx}
              fill="rgba(255, 133, 82, 0.03)"
            />

            {/* Main Axes */}
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

            {/* Median Split Crosshairs */}
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

            {/* Median Axis Indicators */}
            <text
              x={xMedianPx}
              y={PAD.top + PLOT_H + 16}
              textAnchor="middle"
              className="fill-fg-faint text-[9px]"
            >
              med: {formatDuration(xMedian)}
            </text>
            <text
              x={PAD.left - 6}
              y={yMedianPx + 3}
              textAnchor="end"
              className="fill-fg-faint text-[9px]"
            >
              {(yMedian * 100).toFixed(0)}%
            </text>

            {/* Quadrant Functional Labels */}
            {/* Top Right: High Time, High Accuracy */}
            <text
              x={PAD.left + PLOT_W - 6}
              y={PAD.top + 16}
              textAnchor="end"
              className="fill-fg-faint text-[10px] font-medium tracking-wide uppercase"
            >
              Reinforcing / Converted
            </text>
            {/* Top Left: Low Time, High Accuracy */}
            <text
              x={PAD.left + 8}
              y={PAD.top + 16}
              textAnchor="start"
              className="fill-fg-faint text-[10px] font-medium tracking-wide uppercase"
            >
              Efficient / Low Drag
            </text>
            {/* Bottom Right: High Time, Low Accuracy */}
            <text
              x={PAD.left + PLOT_W - 6}
              y={PAD.top + PLOT_H - 10}
              textAnchor="end"
              className="fill-amber-500/80 text-[10px] font-medium tracking-wide uppercase"
            >
              Time Sink / Bottleneck
            </text>
            {/* Bottom Left: Low Time, Low Accuracy */}
            <text
              x={PAD.left + 8}
              y={PAD.top + PLOT_H - 10}
              textAnchor="start"
              className="fill-fg-faint text-[10px] font-medium tracking-wide uppercase"
            >
              Low Exposure
            </text>

            {/* Axis Domain Labels */}
            <text
              x={PAD.left + PLOT_W / 2}
              y={HEIGHT - 10}
              textAnchor="middle"
              className="fill-fg-muted text-[11px] font-medium"
            >
              Time Invested →
            </text>
            <text
              x={16}
              y={PAD.top + PLOT_H / 2}
              textAnchor="middle"
              transform={`rotate(-90 16 ${PAD.top + PLOT_H / 2})`}
              className="fill-fg-muted text-[11px] font-medium"
            >
              Accuracy / Quality Index ↑
            </text>

            {/* Data Points */}
            {points.map((p) => {
              const isSelected = hovered === p.key;
              const hasDimming = hovered !== null && !isSelected;

              return (
                <g
                  key={p.key}
                  onMouseEnter={() => setHovered(p.key)}
                  onMouseLeave={() => setHovered(null)}
                  className="cursor-pointer transition-transform"
                >
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={p.r}
                    fill={frrColor(p.avg_frr)}
                    fillOpacity={hasDimming ? 0.2 : 0.85}
                    stroke="var(--surface)"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={p.x}
                    y={p.y - p.r - 6}
                    textAnchor="middle"
                    className="fill-fg text-[11px] font-mono select-none pointer-events-none"
                    opacity={hasDimming ? 0.2 : 1}
                  >
                    {p.key}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Interactive Inspection Card */}
          {hovered && (
            <div className="mt-4 p-3 bg-surface rounded-md border border-border inline-block min-w-[340px] text-xs">
              {(() => {
                const g = points.find((p) => p.key === hovered)!;
                const hasAccuracyData = g.attempted_total > 0;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-4 border-b border-border pb-1.5">
                      <span className="font-semibold text-fg text-sm">{g.key}</span>
                      <span className="text-fg-muted font-mono">{formatDuration(g.total_seconds)}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-fg-muted pt-0.5">
                      <div>
                        Sessions: <span className="text-fg font-medium">{g.session_count}</span>
                      </div>
                      <div>
                        Composite Score:{" "}
                        <span className="text-fg font-medium">{(g.quality_score * 100).toFixed(0)}%</span>
                      </div>

                      {hasAccuracyData ? (
                        <>
                          <div>
                            Accuracy:{" "}
                            <span className="text-fg font-medium">
                              {((g.correct_total / g.attempted_total) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div>
                            Breakdown:{" "}
                            <span className="text-fg font-medium">
                              {g.correct_total}/{g.attempted_total} correct
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2 text-fg-faint italic">
                          No question attempts logged (scores purely on flow/completion)
                        </div>
                      )}

                      {g.avg_flow_rating !== null && (
                        <div>
                          Avg Flow:{" "}
                          <span className="text-fg font-medium">{g.avg_flow_rating.toFixed(1)} / 3</span>
                        </div>
                      )}
                      {g.avg_frr !== null && (
                        <div>
                          Avg FRR:{" "}
                          <span className="text-fg font-medium">{(g.avg_frr * 100).toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}