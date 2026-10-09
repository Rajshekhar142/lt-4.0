import { db } from "../db";

export type Flashcard = {
  id: number;
  topic: string;
  question: string;
  answer: string;
  created_at: string;
};

let initialized = false;

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function initFlashcardsDb(): void {
  if (initialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  initialized = true;
}

export function getFlashcards(): Flashcard[] {
  initFlashcardsDb();
  const rows = db.prepare("SELECT * FROM flashcards ORDER BY created_at DESC").all();
  return toPlain(rows as Flashcard[]);
}

export function createFlashcard(topic: string, question: string, answer: string): void {
  initFlashcardsDb();
  db.prepare(
    "INSERT INTO flashcards (topic, question, answer, created_at) VALUES (?, ?, ?, ?)"
  ).run(topic.trim(), question.trim(), answer.trim(), new Date().toISOString());
}

export function updateFlashcard(id: number, topic: string, question: string, answer: string): void {
  initFlashcardsDb();
  db.prepare(
    "UPDATE flashcards SET topic = ?, question = ?, answer = ? WHERE id = ?"
  ).run(topic.trim(), question.trim(), answer.trim(), id);
}

export function deleteFlashcard(id: number): void {
  initFlashcardsDb();
  db.prepare("DELETE FROM flashcards WHERE id = ?").run(id);
}
