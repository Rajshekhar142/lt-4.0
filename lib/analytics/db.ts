import { db } from "../db";

export type DrillRecord = {
  id: number;
  topic_id: string;
  section: "VARC" | "DILR" | "QA";
  attempted: number;
  correct: number;
  created_at: string;
};

export type MockRecord = {
  id: number;
  mock_name: string;
  exam_date: string;
  varc_score: number;
  dilr_score: number;
  qa_score: number;
  total_score: number;
};

let initialized = false;

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function initAnalyticsDb(): void {
  if (initialized) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS drill_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT NOT NULL,
      section TEXT NOT NULL,
      attempted INTEGER NOT NULL,
      correct INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mock_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mock_name TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      varc_score REAL NOT NULL,
      dilr_score REAL NOT NULL,
      qa_score REAL NOT NULL,
      total_score REAL NOT NULL
    );
  `);

  initialized = true;
}

export function logDrill(
  topicId: string,
  section: "VARC" | "DILR" | "QA",
  attempted: number,
  correct: number
): void {
  initAnalyticsDb();
  db.prepare(
    `INSERT INTO drill_logs (topic_id, section, attempted, correct, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(topicId, section, attempted, correct, new Date().toISOString());
}

export function getDrillsByTopic(topicId: string): DrillRecord[] {
  initAnalyticsDb();
  const rows = db
    .prepare(
      `SELECT * FROM drill_logs WHERE topic_id = ? ORDER BY created_at ASC`
    )
    .all(topicId);
  return toPlain(rows as DrillRecord[]);
}

export function getAllDrills(): DrillRecord[] {
  initAnalyticsDb();
  const rows = db
    .prepare(`SELECT * FROM drill_logs ORDER BY created_at ASC`)
    .all();
  return toPlain(rows as DrillRecord[]);
}

export function logMock(
  mockName: string,
  examDate: string,
  varc: number,
  dilr: number,
  qa: number
): void {
  initAnalyticsDb();
  const total = varc + dilr + qa;
  db.prepare(
    `INSERT INTO mock_scores (mock_name, exam_date, varc_score, dilr_score, qa_score, total_score)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(mockName, examDate, varc, dilr, qa, total);
}

export function getMocks(): MockRecord[] {
  initAnalyticsDb();
  const rows = db
    .prepare(`SELECT * FROM mock_scores ORDER BY exam_date ASC`)
    .all();
  return toPlain(rows as MockRecord[]);
}