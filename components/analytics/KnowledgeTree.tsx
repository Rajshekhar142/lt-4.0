"use client";

import { useMemo, useState } from "react";
import {
  computeTreeLayout,
  LayoutNode,
  SVG_HEIGHT,
  SVG_WIDTH,
  TRUNK_BASE_Y,
  TRUNK_TOP_Y,
  TRUNK_X,
  SECTION_LABELS,
} from "@/lib/analytics/syllabus";
import type { NodeMastery } from "@/lib/analytics/actions";

const SECTION_THEMES = {
  QA: {
    stroke: "#ff8552",
    glow: "#ff8552",
    fill: "rgba(255, 133, 82, 0.15)",
  },
  VARC: {
    stroke: "#6c8ae4",
    glow: "#6c8ae4",
    fill: "rgba(108, 138, 228, 0.15)",
  },
  DILR: {
    stroke: "#4caf7d",
    glow: "#4caf7d",
    fill: "rgba(76, 175, 125, 0.15)",
  },
};

const round = (val: number) => Number(val.toFixed(2));

/** Splits a quadratic Bézier curve at parameter t in [0, 1] using de Casteljau's algorithm */
function splitQuadBezier(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  t: number
) {
  const qx1 = x0 + t * (cx - x0);
  const qy1 = y0 + t * (cy - y0);
  const qx2 = cx + t * (x1 - cx);
  const qy2 = cy + t * (y1 - cy);
  const bx = qx1 + t * (qx2 - qx1);
  const by = qy1 + t * (qy2 - qy1);

  return {
    cx: round(qx1),
    cy: round(qy1),
    x1: round(bx),
    y1: round(by),
  };
}

export default function KnowledgeTree({
  treeData,
}: {
  treeData: Record<string, NodeMastery>;
}) {
  const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

  const layout = useMemo(() => computeTreeLayout(), []);

  // Compute aggregated mastery for primary branches from their leaf children
  const effectiveMastery = useMemo(() => {
    const acc: Record<string, { accuracy: number; activated: boolean; rawAttempts: number; tier: string }> = {};

    for (const node of layout) {
      if (node.isLeaf) {
        const m = treeData[node.id];
        acc[node.id] = {
          accuracy: m?.weighted_accuracy ?? 0,
          activated: m?.is_activated ?? false,
          rawAttempts: m?.raw_attempted ?? 0,
          tier: m?.tier ?? "locked",
        };
      }
    }

    // Roll up leaf metrics to parents
    for (const node of layout) {
      if (!node.isLeaf) {
        const children = layout.filter((n) => n.parentId === node.id);
        const childMasteries = children.map((c) => acc[c.id]).filter(Boolean);

        const totalAttempts = childMasteries.reduce((sum, c) => sum + c.rawAttempts, 0);
        const avgAccuracy =
          childMasteries.length > 0
            ? childMasteries.reduce((sum, c) => sum + c.accuracy, 0) / childMasteries.length
            : 0;
        const allActivated = childMasteries.length > 0 && childMasteries.every((c) => c.activated);

        let tier = "locked";
        if (avgAccuracy >= 0.9) tier = "gold";
        else if (avgAccuracy >= 0.8) tier = "silver";
        else if (avgAccuracy >= 0.6) tier = "bronze";

        acc[node.id] = {
          accuracy: avgAccuracy,
          activated: allActivated,
          rawAttempts: totalAttempts,
          tier,
        };
      }
    }

    return acc;
  }, [layout, treeData]);

  // Overall syllabus completion percentage for trunk vitality
  const overallProgress = useMemo(() => {
    const leafNodes = layout.filter((n) => n.isLeaf);
    if (leafNodes.length === 0) return 0;
    const mastered = leafNodes.filter((l) => effectiveMastery[l.id]?.accuracy >= 0.8).length;
    return mastered / leafNodes.length;
  }, [layout, effectiveMastery]);

  const activeMastery = hoveredNode ? effectiveMastery[hoveredNode.id] : null;

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center select-none">
      {/* Floating HUD Tooltip */}
      <div className="absolute top-2 left-2 z-10 min-h-[76px] min-w-[240px] rounded-lg border border-zinc-800 bg-zinc-950/85 p-3 text-xs shadow-2xl backdrop-blur-md transition-all">
        {hoveredNode && activeMastery ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-zinc-100">{hoveredNode.name}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{
                  color: SECTION_THEMES[hoveredNode.section].stroke,
                  backgroundColor: SECTION_THEMES[hoveredNode.section].fill,
                }}
              >
                {hoveredNode.section}
              </span>
            </div>

            <div className="text-[11px] text-zinc-400">
              {SECTION_LABELS[hoveredNode.section]}
            </div>

            {activeMastery.activated ? (
              <div className="flex items-center gap-2 pt-1">
                <span className="font-mono text-xs font-semibold text-emerald-400">
                  {(activeMastery.accuracy * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-zinc-500">
                  ({activeMastery.rawAttempts} questions logged)
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-300 ml-auto">
                  {activeMastery.tier}
                </span>
              </div>
            ) : (
              <div className="pt-1 text-[11px] text-amber-400/90 font-medium">
                Calibrating: Needs {Math.max(0, 15 - activeMastery.rawAttempts)} more attempts
              </div>
            )}

            {hoveredNode.covers && (
              <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-900 line-clamp-1">
                {hoveredNode.covers.join(" • ")}
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-full flex-col justify-center text-zinc-500">
            <span>Hover branch nodes to inspect mastery</span>
            <span className="text-[10px] text-zinc-600 mt-1">
              Branches light up as weighted drill accuracy builds
            </span>
          </div>
        )}
      </div>

      {/* SVG Knowledge Canvas */}
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="h-full w-full max-h-[620px] overflow-visible"
      >
        <defs>
          {/* Neon Bloom Filter */}
          <filter id="treeGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Intense Gold Halo */}
          <filter id="goldHalo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Dynamic Trunk Energy Gradient */}
          <linearGradient id="trunkEnergy" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#27272a" />
            <stop
              offset={`${Math.min(100, Math.round(overallProgress * 100))}%`}
              stopColor="#38bdf8"
              stopOpacity="0.85"
            />
            <stop offset="100%" stopColor="#18181b" />
          </linearGradient>
        </defs>

        {/* Central Organic Spine / Trunk */}
        <line
          x1={TRUNK_X}
          y1={TRUNK_BASE_Y}
          x2={TRUNK_X}
          y2={TRUNK_TOP_Y}
          stroke="#18181b"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <line
          x1={TRUNK_X}
          y1={TRUNK_BASE_Y}
          x2={TRUNK_X}
          y2={TRUNK_TOP_Y}
          stroke="url(#trunkEnergy)"
          strokeWidth="4"
          strokeLinecap="round"
          filter={overallProgress > 0.4 ? "url(#treeGlow)" : undefined}
        />

        {/* Render Primary Branches & Sub-branches */}
        {layout.map((node) => {
          const stats = effectiveMastery[node.id];
          const accuracy = stats?.accuracy ?? 0;
          const isActivated = stats?.activated ?? false;
          const tier = stats?.tier ?? "locked";

          const theme = SECTION_THEMES[node.section];
          const isPrimary = node.depth === 0;

          // Compute illuminated partial Bézier curve
          const litT = isActivated ? Math.max(0.12, accuracy) : 0.08;
          const litCurve = splitQuadBezier(
            node.x0,
            node.y0,
            node.cx,
            node.cy,
            node.x1,
            node.y1,
            litT
          );

          const isHovered = hoveredNode?.id === node.id;
          const strokeWidth = isPrimary ? 3.5 : 2.2;

          let tipFill = "#3f3f46";
          if (isActivated) {
            if (tier === "gold") tipFill = "#fbbf24";
            else if (tier === "silver") tipFill = "#e2e8f0";
            else tipFill = theme.stroke;
          }

          return (
            <g
              key={node.id}
              className="cursor-pointer transition-transform duration-200"
              onMouseEnter={() => setHoveredNode(node)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              {/* Ghost Guide Path */}
<path
  d={`M ${node.x0.toFixed(2)} ${node.y0.toFixed(2)} Q ${node.cx.toFixed(2)} ${node.cy.toFixed(2)} ${node.x1.toFixed(2)} ${node.y1.toFixed(2)}`}
  fill="none"
  stroke="#1f1f23"
  strokeWidth={strokeWidth}
  strokeLinecap="round"
/>

{/* Illuminated Accuracy Tendril */}
<path
  d={`M ${node.x0.toFixed(2)} ${node.y0.toFixed(2)} Q ${litCurve.cx.toFixed(2)} ${litCurve.cy.toFixed(2)} ${litCurve.x1.toFixed(2)} ${litCurve.y1.toFixed(2)}`}
  fill="none"
  stroke={theme.stroke}
  strokeWidth={strokeWidth}
  strokeLinecap="round"
  opacity={isActivated ? 0.95 : 0.25}
  filter={isActivated && accuracy >= 0.8 ? "url(#treeGlow)" : undefined}
/>

              {/* Gold Mastery Pulse Animation */}
              {isActivated && tier === "gold" && (
                <circle
                  cx={round(node.x1)}
                  cy={round(node.y1)}
                  r={node.isLeaf ? 8 : 10}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.5"
                  opacity="0.6"
                  className="animate-ping"
                />
              )}

              {/* Branch Tip Mastery Node */}
              <circle
                cx={round(node.x1)}
                cy={round(node.y1)}
                r={isHovered ? 6 : node.isLeaf ? 4 : 5}
                fill={tipFill}
                stroke="#09090b"
                strokeWidth={1.5}
                filter={isActivated && tier === "gold" ? "url(#goldHalo)" : undefined}
                className="transition-all duration-150"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}