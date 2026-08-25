"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration } from "@/lib/format";

const DOMAINS = [
  { name: "Builder", color: "#ff8552", desc: "Shipping. Infra, code, things that ship." },
  { name: "Learner", color: "#6c8ae4", desc: "Study with proof — FRR, PoA, flow rating." },
  { name: "Casual", color: "#4caf7d", desc: "Everything else. Tracked, not judged." },
];

export default function LandingPage() {
  // Ambient hero: counts up from page load, same font-mono readout as the
  // tracker itself. It's not tracking a real session — it's a preview of
  // what the app looks like mid-session, ticking before you've even logged in.
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="font-mono text-6xl sm:text-7xl tabular tracking-tight"
          style={{ color: "var(--fg-faint)" }}
        >
          {formatDuration(elapsed)}
        </div>
        <div className="mt-3 text-sm text-fg-muted">
          that's how long you've been reading this instead of starting
        </div>

        <h1 className="mt-10 text-2xl sm:text-3xl font-medium text-fg max-w-md">
          LifeTracker
        </h1>
        <p className="mt-3 text-sm text-fg-muted max-w-sm leading-relaxed">
          Not another timer. Every session gets a domain, a friction score,
          proof of what it produced, and how it actually ended — so the data
          can tell you what you've been prioritizing, not just how long you sat there.
        </p>

        <Link
          href="/login"
          className="mt-8 px-6 py-2.5 rounded-md border border-border bg-surface hover:bg-surface-hover text-sm font-medium text-fg transition-colors"
        >
          Sign in
        </Link>
      </div>

      <div className="border-t border-border">
        <div className="max-w-md mx-auto grid grid-cols-3 divide-x divide-border">
          {DOMAINS.map((d) => (
            <div key={d.name} className="px-4 py-6 text-center">
              <span
                className="inline-block h-2 w-2 rounded-full mb-2"
                style={{ background: d.color }}
              />
              <div className="text-xs font-medium text-fg">{d.name}</div>
              <div className="mt-1 text-[11px] text-fg-faint leading-snug">
                {d.desc}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
