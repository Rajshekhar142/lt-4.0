"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/flashcards/db";
import {
  createFlashcardAction,
  updateFlashcardAction,
  deleteFlashcardAction,
} from "@/lib/flashcards/actions";

export default function FlashcardManager({ flashcards }: { flashcards: Flashcard[] }) {
  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form states
  const [topic, setTopic] = useState("Error Logs");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topics = ["ALL", "Error Logs", "QA", "VARC", "DILR", "General"];

  const filteredCards =
    selectedTopic === "ALL"
      ? flashcards
      : flashcards.filter((c) => c.topic.toLowerCase() === selectedTopic.toLowerCase());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !question || !answer) return;

    setIsSubmitting(true);
    try {
      if (editingId !== null) {
        await updateFlashcardAction(editingId, topic, question, answer);
        setEditingId(null);
      } else {
        await createFlashcardAction(topic, question, answer);
      }
      setQuestion("");
      setAnswer("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (card: Flashcard) => {
    setEditingId(card.id);
    setTopic(card.topic);
    setQuestion(card.question);
    setAnswer(card.answer);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setTopic("Error Logs");
    setQuestion("");
    setAnswer("");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full gap-6 p-6">
      {/* Left Column: Form & Filters */}
      <div className="w-1/3 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="text-sm font-semibold text-zinc-200">
          {editingId !== null ? "Edit Flashcard" : "Create Flashcard"}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div>
            <label className="mb-1 block text-zinc-500">Topic Category</label>
            <input
              type="text"
              list="topic-suggestions"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Error Logs, QA, VARC"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 outline-none focus:border-zinc-700"
              required
            />
            <datalist id="topic-suggestions">
              <option value="Error Logs" />
              <option value="QA" />
              <option value="VARC" />
              <option value="DILR" />
            </datalist>
          </div>

          <div>
            <label className="mb-1 block text-zinc-500">Question / Error Context</label>
            <textarea
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What went wrong or what is the prompt?"
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 outline-none focus:border-zinc-700 resize-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-zinc-500">Answer / Resolution / Takeaway</label>
            <textarea
              rows={4}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Correct approach or fix..."
              className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-200 outline-none focus:border-zinc-700 resize-none"
              required
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded bg-zinc-100 py-2 font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : editingId !== null ? "Update Card" : "Add Flashcard"}
            </button>
            {editingId !== null && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded border border-zinc-800 px-3 py-2 text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right Column: Cards Grid / List */}
      <div className="flex-1 flex flex-col gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-5 overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="text-sm font-semibold text-zinc-200">
            Flashcards ({filteredCards.length})
          </div>
          {/* Topic Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto">
            {topics.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTopic(t)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  selectedTopic === t
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {filteredCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              No flashcards found for this category.
            </div>
          ) : (
            filteredCards.map((card) => (
              <div
                key={card.id}
                className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-4 transition hover:border-zinc-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      card.topic.toLowerCase() === "error logs"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {card.topic}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(card)}
                      className="text-xs text-zinc-400 hover:text-zinc-200 transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteFlashcardAction(card.id)}
                      className="text-xs text-rose-400 hover:text-rose-300 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="text-xs font-medium text-zinc-200 mb-2">
                  <span className="text-zinc-500 mr-1.5">Q:</span>
                  {card.question}
                </div>

                <div className="text-xs text-zinc-400 border-t border-zinc-800/60 pt-2">
                  <span className="text-zinc-500 mr-1.5">A:</span>
                  {card.answer}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
