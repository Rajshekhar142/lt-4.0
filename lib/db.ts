import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// Single sqlite file, lives on disk. On serverless platforms without a
// persistent filesystem this will NOT survive between invocations —
// deploy this app as one long-running service (Fly.io, Render, a VPS),
// not as Vercel serverless functions.
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "lifetracker.db");

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Reuse a single connection across Next.js hot-reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __ltDb: DatabaseSync | undefined;
}

const db = globalThis.__ltDb ?? new DatabaseSync(DB_PATH);
if (process.env.NODE_ENV !== "production") globalThis.__ltDb = db;

db.exec(`
  CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS time_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL REFERENCES domains(id),
    started_at TEXT NOT NULL,
    ended_at TEXT,
    duration_seconds INTEGER
  );
`);

// Seed exactly 3 domains on first run. Edit this list to rename/re-theme
// your domains — it only ever runs once (guarded by the count check).
const DEFAULT_DOMAINS: { name: string; color: string }[] = [
  { name: "Builder", color: "#ff8552" },
  { name: "Learner", color: "#6c8ae4" },
  { name: "Casual", color: "#4caf7d" },
];

const countRow = db.prepare("SELECT COUNT(*) as c FROM domains").get() as
  | { c: number }
  | undefined;

if (!countRow || countRow.c === 0) {
  const insert = db.prepare(
    "INSERT INTO domains (name, color) VALUES (?, ?)"
  );
  for (const d of DEFAULT_DOMAINS) insert.run(d.name, d.color);
}

export type Domain = { id: number; name: string; color: string };
export type TimeEntry = {
  id: number;
  domain_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
};

// node:sqlite rows aren't plain objects (they can't cross the server
// action -> client component boundary as-is), so anything handed to a
// client component gets normalized through this first.
function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function getDomains(): Domain[] {
  const rows = db.prepare("SELECT * FROM domains ORDER BY id").all() as Domain[];
  return toPlain(rows);
}

export function getActiveEntry(): (TimeEntry & { domain_name: string }) | null {
  const row = db
    .prepare(
      `SELECT te.*, d.name as domain_name
       FROM time_entries te JOIN domains d ON d.id = te.domain_id
       WHERE te.ended_at IS NULL
       ORDER BY te.id DESC LIMIT 1`
    )
    .get() as (TimeEntry & { domain_name: string }) | undefined;
  return row ? toPlain(row) : null;
}

export function startEntry(domainId: number): TimeEntry {
  // Stop any currently-running entry first — only one timer runs at a time.
  const active = getActiveEntry();
  if (active) stopEntry(active.id);

  const startedAt = new Date().toISOString();
  const result = db
    .prepare(
      "INSERT INTO time_entries (domain_id, started_at) VALUES (?, ?)"
    )
    .run(domainId, startedAt);

  return toPlain(
    db
      .prepare("SELECT * FROM time_entries WHERE id = ?")
      .get(result.lastInsertRowid) as TimeEntry
  );
}

export function stopEntry(entryId: number): TimeEntry {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(entryId) as TimeEntry;

  const endedAt = new Date();
  const startedAt = new Date(entry.started_at);
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  db.prepare(
    "UPDATE time_entries SET ended_at = ?, duration_seconds = ? WHERE id = ?"
  ).run(endedAt.toISOString(), durationSeconds, entryId);

  return toPlain(
    db.prepare("SELECT * FROM time_entries WHERE id = ?").get(entryId) as TimeEntry
  );
}

// Seconds accumulated per domain so far today, from completed entries only.
// (The currently-running entry's elapsed time is added live on the client.)
export function getTodayTotals(): Record<number, number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const rows = db
    .prepare(
      `SELECT domain_id, SUM(duration_seconds) as total
       FROM time_entries
       WHERE started_at >= ? AND ended_at IS NOT NULL
       GROUP BY domain_id`
    )
    .all(startOfDay.toISOString()) as { domain_id: number; total: number }[];

  const totals: Record<number, number> = {};
  for (const r of rows) totals[r.domain_id] = r.total;
  return totals;
}

export function getHistory(days: number): (TimeEntry & { domain_name: string; domain_color: string })[] {
  const since = new Date();
  since.setDate(since.getDate() - days);

  return db
    .prepare(
      `SELECT te.*, d.name as domain_name, d.color as domain_color
       FROM time_entries te JOIN domains d ON d.id = te.domain_id
       WHERE te.started_at >= ? AND te.ended_at IS NOT NULL
       ORDER BY te.started_at DESC`
    )
    .all(since.toISOString()) as (TimeEntry & {
    domain_name: string;
    domain_color: string;
  })[];
}
