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
const PAD = { top: 28, right: 28, bottom: 44, left: 48 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const EDGE_ZONE = 70; // px from a plot edge where label anchoring flips

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

// "DILR/circular-arrangement" -> "circular-arrangement" (subject stays
// visible in the tag itself and in the hover card; the bubble only needs
// the specific part). Long single-word tags still get trimmed.
function shortLabel(key: string): string {
  const parts = key.split("/");
  const base = parts.length > 1 ? parts[parts.length - 1] : key;
  return base.length > 16 ? base.slice(0, 15) + "…" : base;
}

// Keep every label's bounding box inside the plot area instead of letting
// textAnchor="middle" push it past the left/right edge for points that sit
// near either side of the chart.
function labelAnchor(x: number): "start" | "middle" | "end" {
  if (x < PAD.left + EDGE_ZONE) return "start";
  if (x > PAD.left + PLOT_W - EDGE_ZONE) return "end";
  return "middle";
}

function labelX(x: number, anchor: "start" | "middle" | "end"): number {
  if (anchor === "start") return x + 6;
  if (anchor === "end") return x - 6;
  return x;
}

// Flip the label below the point instead of above when there isn't enough
// headroom to the top edge of the plot.
function labelY(y: number, r: number): { y: number; baseline: "auto" | "hanging" } {
  const above = y - r - 8;
  if (above < PAD.top + 10) {
    return { y: y + r + 16, baseline: "hanging" };
  }
  return { y: above, baseline: "auto" };
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

    const points = groups.map((g) => {
      const x = PAD.left + (g.total_seconds / xMax) * PLOT_W;
      const y = PAD.top + PLOT_H - g.quality_score * PLOT_H;
      const r = Math.max(5, Math.min(20, 5 + (g.session_count / maxCount) * 13));
      const anchor = labelAnchor(x);
      const { y: ly, baseline } = labelY(y, r);

      return {
        ...g,
        x,
        y,
        r,
        label: shortLabel(g.key),
        labelAnchor: anchor,
        labelX: labelX(x, anchor),
        labelY: ly,
        labelBaseline: baseline,
      };
    });

    return { points, xMedian: median(xs), yMedian: median(ys), xMax };
  }, [groups]);

  const xMedianPx = PAD.left + (xMedian / xMax) * PLOT_W;
  const yMedianPx = PAD.top + PLOT_H - yMedian * PLOT_H;
  const hoveredPoint = points.find((p) => p.key === hovered) ?? null;

  return (
    <div className="mb-10 pb-8 border-b border-border">
      <div className="flex items-start justify-between mb-1 gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-medium text-fg">Topic priority quadrant</h2>
          <p className="text-xs text-fg-muted mt-0.5">
            Time invested vs. accuracy, last 30 days — hover a bubble for the full breakdown
          </p>
        </div>
      </div>

      {/* Legend — read the chart without hovering anything first */}
      <div className="flex items-center gap-4 text-[11px] text-fg-faint mb-5 mt-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#6c8ae4" }} />
          low friction
          <span className="inline-block h-2.5 w-2.5 rounded-full ml-1" style={{ background: "#ff8552" }} />
          high friction
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-faint" />
          <span className="inline-block h-3 w-3 rounded-full bg-fg-faint" />
          bubble size = session count
        </span>
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
            {/* Quadrant tints */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={xMedianPx - PAD.left}
              height={yMedianPx - PAD.top}
              fill="rgba(108, 138, 228, 0.04)"
            />
            <rect
              x={xMedianPx}
              y={yMedianPx}
              width={PAD.left + PLOT_W - xMedianPx}
              height={PAD.top + PLOT_H - yMedianPx}
              fill="rgba(255, 133, 82, 0.04)"
            />

            {/* Axes */}
            <line x1={PAD.left} y1={PAD.top + PLOT_H} x2={PAD.left + PLOT_W} y2={PAD.top + PLOT_H} stroke="var(--border)" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + PLOT_H} stroke="var(--border)" />

            {/* Median split */}
            <line x1={xMedianPx} y1={PAD.top} x2={xMedianPx} y2={PAD.top + PLOT_H} stroke="var(--fg-faint)" strokeDasharray="4 4" />
            <line x1={PAD.left} y1={yMedianPx} x2={PAD.left + PLOT_W} y2={yMedianPx} stroke="var(--fg-faint)" strokeDasharray="4 4" />

            {/* Quadrant labels — short, low-emphasis, corners only */}
            <text x={PAD.left + PLOT_W - 6} y={PAD.top + 14} textAnchor="end" className="fill-fg-faint text-[9px] tracking-wide uppercase">
              converted
            </text>
            <text x={PAD.left + 6} y={PAD.top + 14} textAnchor="start" className="fill-fg-faint text-[9px] tracking-wide uppercase">
              efficient
            </text>
            <text x={PAD.left + PLOT_W - 6} y={PAD.top + PLOT_H - 8} textAnchor="end" className="fill-amber-500/80 text-[9px] tracking-wide uppercase">
              time sink
            </text>
            <text x={PAD.left + 6} y={PAD.top + PLOT_H - 8} textAnchor="start" className="fill-fg-faint text-[9px] tracking-wide uppercase">
              low exposure
            </text>

            {/* Axis titles */}
            <text x={PAD.left + PLOT_W / 2} y={HEIGHT - 8} textAnchor="middle" className="fill-fg-muted text-[11px] font-medium">
              time invested →
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

            {/* Points */}
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
                    r={p.r}
                    fill={frrColor(p.avg_frr)}
                    fillOpacity={dimmed ? 0.18 : 0.85}
                    stroke="var(--surface)"
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={p.labelX}
                    y={p.labelY}
                    textAnchor={p.labelAnchor}
                    dominantBaseline={p.labelBaseline}
                    className="fill-fg text-[10px] font-mono pointer-events-none"
                    opacity={dimmed ? 0.15 : 1}
                  >
                    {p.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Fixed-height detail slot — always reserved, so hovering never
              shifts layout, and it never needs to compete for space with
              the chart itself. */}
          <div className="mt-4 min-h-[92px]">
            {hoveredPoint ? (
              <div className="p-3 bg-surface rounded-md border border-border text-xs max-w-md">
                <div className="flex items-center justify-between gap-4 border-b border-border pb-1.5">
                  <span className="font-semibold text-fg text-sm">{hoveredPoint.key}</span>
                  <span className="text-fg-muted font-mono">{formatDuration(hoveredPoint.total_seconds)}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-fg-muted pt-1.5">
                  <div>Sessions: <span className="text-fg font-medium">{hoveredPoint.session_count}</span></div>
                  <div>Composite: <span className="text-fg font-medium">{(hoveredPoint.quality_score * 100).toFixed(0)}%</span></div>

                  {hoveredPoint.attempted_total > 0 ? (
                    <>
                      <div>
                        Accuracy:{" "}
                        <span className="text-fg font-medium">
                          {((hoveredPoint.correct_total / hoveredPoint.attempted_total) * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        Breakdown:{" "}
                        <span className="text-fg font-medium">
                          {hoveredPoint.correct_total}/{hoveredPoint.attempted_total}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 text-fg-faint italic">
                      No question attempts logged — scored on flow/completion only
                    </div>
                  )}

                  {hoveredPoint.avg_flow_rating !== null && (
                    <div>Flow: <span className="text-fg font-medium">{hoveredPoint.avg_flow_rating.toFixed(1)}/3</span></div>
                  )}
                  {hoveredPoint.avg_frr !== null && (
                    <div>FRR: <span className="text-fg font-medium">{(hoveredPoint.avg_frr * 100).toFixed(0)}%</span></div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-fg-faint italic pt-2">Hover a bubble for the full breakdown.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
