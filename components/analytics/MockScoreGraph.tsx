"use client";

import type { MockRecord } from "@/lib/analytics/db";

export default function MockScoreGraph({ mocks }: { mocks: MockRecord[] }) {
  if (mocks.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-zinc-600">
        No mock tests logged yet.
      </div>
    );
  }

  const width = 450;
  const height = 220;
  const pad = 30;

  const maxScore = Math.max(60, ...mocks.map((m) => Math.max(m.varc_score, m.dilr_score, m.qa_score)));

  const getX = (idx: number) => {
    if (mocks.length === 1) return width / 2;
    return pad + (idx / (mocks.length - 1)) * (width - 2 * pad);
  };

  const getY = (val: number) => height - pad - (val / maxScore) * (height - 2 * pad);

  const buildPath = (key: "varc_score" | "dilr_score" | "qa_score") =>
    mocks
      .map((m, idx) => `${idx === 0 ? "M" : "L"} ${getX(idx)} ${getY(m[key])}`)
      .join(" ");

  return (
    <div className="flex h-full w-full flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">Mock Performance Trajectory</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#6c8ae4]" /> VARC</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#4caf7d]" /> DILR</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#ff8552]" /> QA</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full">
        {/* Baseline Axis */}
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#27272a" strokeWidth="1" />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#27272a" strokeWidth="1" />

        {/* Trajectory Lines */}
        <path d={buildPath("varc_score")} fill="none" stroke="#6c8ae4" strokeWidth="2" />
        <path d={buildPath("dilr_score")} fill="none" stroke="#4caf7d" strokeWidth="2" />
        <path d={buildPath("qa_score")} fill="none" stroke="#ff8552" strokeWidth="2" />

        {/* Data points */}
        {mocks.map((m, idx) => (
          <g key={m.id}>
            <circle cx={getX(idx)} cy={getY(m.varc_score)} r="3" fill="#6c8ae4" />
            <circle cx={getX(idx)} cy={getY(m.dilr_score)} r="3" fill="#4caf7d" />
            <circle cx={getX(idx)} cy={getY(m.qa_score)} r="3" fill="#ff8552" />
          </g>
        ))}
      </svg>
    </div>
  );
}
