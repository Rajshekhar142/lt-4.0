"use client";

import { useState } from "react";
import { ALL_LEAF_TOPICS } from "@/lib/analytics/syllabus";
import { logDrillAction, logMockAction } from "@/lib/analytics/actions";

export default function DrillLogger() {
  const [activeTab, setActiveTab] = useState<"drill" | "mock">("drill");

  // Drill form state
  const [selectedTopic, setSelectedTopic] = useState(ALL_LEAF_TOPICS[0].id);
  const [attempted, setAttempted] = useState("");
  const [correct, setCorrect] = useState("");

  // Mock form state
  const [mockName, setMockName] = useState("");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [varcScore, setVarcScore] = useState("");
  const [dilrScore, setDilrScore] = useState("");
  const [qaScore, setQaScore] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDrillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const att = parseInt(attempted, 10);
    const cor = parseInt(correct, 10);
    if (isNaN(att) || isNaN(cor) || att <= 0 || cor < 0 || cor > att) return;

    const topicConfig = ALL_LEAF_TOPICS.find((t) => t.id === selectedTopic);
    if (!topicConfig) return;

    setIsSubmitting(true);
    try {
      await logDrillAction(topicConfig.id, topicConfig.section, att, cor);
      setAttempted("");
      setCorrect("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(varcScore);
    const d = parseFloat(dilrScore);
    const q = parseFloat(qaScore);
    if (!mockName.trim() || !examDate || isNaN(v) || isNaN(d) || isNaN(q)) return;

    setIsSubmitting(true);
    try {
      await logMockAction(mockName.trim(), examDate, v, d, q);
      setMockName("");
      setVarcScore("");
      setDilrScore("");
      setQaScore("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col justify-between text-xs">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("drill")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              activeTab === "drill"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Log Topic Drill
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mock")}
            className={`rounded px-2.5 py-1 font-medium transition ${
              activeTab === "mock"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Log Mock Exam
          </button>
        </div>
      </div>

      {activeTab === "drill" ? (
        <form onSubmit={handleDrillSubmit} className="grid grid-cols-3 gap-2 pt-2">
          <div className="col-span-3">
            <label className="mb-1 block text-zinc-500">Topic</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            >
              {ALL_LEAF_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-zinc-500">Attempted</label>
            <input
              type="number"
              min="1"
              value={attempted}
              onChange={(e) => setAttempted(e.target.value)}
              placeholder="e.g. 10"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-zinc-500">Correct</label>
            <input
              type="number"
              min="0"
              value={correct}
              onChange={(e) => setCorrect(e.target.value)}
              placeholder="e.g. 8"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-zinc-100 py-1.5 font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-50"
            >
              {isSubmitting ? "..." : "Save Drill"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMockSubmit} className="grid grid-cols-5 gap-2 pt-2">
          <div className="col-span-3">
            <label className="mb-1 block text-zinc-500">Mock Name</label>
            <input
              type="text"
              value={mockName}
              onChange={(e) => setMockName(e.target.value)}
              placeholder="e.g. SIMCAT 4 / AIMCAT 2026"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="col-span-2">
            <label className="mb-1 block text-zinc-500">Date</label>
            <input
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-[#6c8ae4]">VARC</label>
            <input
              type="number"
              step="any"
              value={varcScore}
              onChange={(e) => setVarcScore(e.target.value)}
              placeholder="Score"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-[#4caf7d]">DILR</label>
            <input
              type="number"
              step="any"
              value={dilrScore}
              onChange={(e) => setDilrScore(e.target.value)}
              placeholder="Score"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-[#ff8552]">QA</label>
            <input
              type="number"
              step="any"
              value={qaScore}
              onChange={(e) => setQaScore(e.target.value)}
              placeholder="Score"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-zinc-200 outline-none focus:border-zinc-700"
            />
          </div>

          <div className="col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded bg-zinc-100 py-1.5 font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-50"
            >
              {isSubmitting ? "..." : "Save Mock"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}