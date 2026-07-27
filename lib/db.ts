import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// Single sqlite file, lives on disk. On serverless platforms without a
// persistent filesystem this will NOT survive between invocations —
// deploy this app as one long-running service (Fly.io, Render, a VPS),
// not as Vercel serverless functions.
const DB_DIR = path.join(process.cwd(), "data");
// Tests run with NODE_ENV=test (vitest sets this automatically) — point
// them at a separate file so `npx vitest` can never wipe your real,
// actually-tracked history in data/lifetracker.db.
const DB_FILENAME =
  process.env.NODE_ENV === "test" ? "lifetracker.test.db" : "lifetracker.db";
const DB_PATH = path.join(DB_DIR, DB_FILENAME);

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

// Reuse a single connection across Next.js hot-reloads in dev.
declare global {
  // eslint-disable-next-line no-var
  var __ltDb: DatabaseSync | undefined;
}

let _db: DatabaseSync | null = null;

// Everything that used to run at module top level — opening the file,
// PRAGMAs, CREATE TABLE, migrations, seeding — now only runs the first
// time a real query actually happens. Next's build step imports every
// route module to statically analyze it (even force-dynamic ones), which
// used to open/lock the sqlite file just from being imported — this is
// what caused "database is locked" build failures whenever a stale
// connection or another process touched the file at the same moment.
// Lazy init means merely importing this module is now a complete no-op
// on disk; nothing happens until getDb() is actually invoked.
function getDb(): DatabaseSync {
  if (_db) return _db;

  const instance = globalThis.__ltDb ?? new DatabaseSync(DB_PATH);
  if (process.env.NODE_ENV !== "production") globalThis.__ltDb = instance;

  // WAL mode lets readers and a writer coexist instead of locking the
  // whole file on every write. busy_timeout makes SQLite retry for a bit
  // instead of immediately throwing "database is locked" if two
  // processes ever do genuinely overlap.
  instance.exec("PRAGMA journal_mode = WAL;");
  instance.exec("PRAGMA busy_timeout = 5000;");

  instance.exec(`
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
      description TEXT,
      duration_seconds INTEGER
    );
  `);

  // --- Migrations ---
  // CREATE TABLE IF NOT EXISTS is a no-op against a table that already
  // exists — so on a production db created before `description` existed,
  // the block above does nothing and the column is silently missing.
  // This checks the *actual* on-disk schema and adds the column only if
  // it's not already there. Existing rows are untouched; description just
  // comes back NULL for anything logged before this shipped.
  const timeEntriesColumns = instance
    .prepare("PRAGMA table_info(time_entries)")
    .all() as { name: string }[];

  const hasDescription = timeEntriesColumns.some(
    (col) => col.name === "description"
  );

  if (!hasDescription) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN description TEXT");
  }

  // Seed exactly 3 domains on first run. Edit this list to rename/re-theme
  // your domains — it only ever runs once (guarded by the count check).
  const DEFAULT_DOMAINS: { name: string; color: string }[] = [
    { name: "Builder", color: "#ff8552" },
    { name: "Learner", color: "#6c8ae4" },
    { name: "Casual", color: "#4caf7d" },
  ];

  const countRow = instance.prepare("SELECT COUNT(*) as c FROM domains").get() as
    | { c: number }
    | undefined;

  if (!countRow || countRow.c === 0) {
    const insert = instance.prepare(
      "INSERT INTO domains (name, color) VALUES (?, ?)"
    );
    for (const d of DEFAULT_DOMAINS) insert.run(d.name, d.color);
  }

  _db = instance;
  return _db;
}

// Proxy so `import { db } from './db'; db.prepare(...)` (used directly by
// tests) keeps working unchanged — but the underlying connection/schema
// setup only actually happens on first real property access, not at
// import time. Importing this module is now always a no-op on disk.
export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type Domain = { id: number; name: string; color: string };
export type TimeEntry = {
  id: number;
  domain_id: number;
  started_at: string;
  ended_at: string | null;
  description: string | null;
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

export function stopEntry(entryId: number, description: string = ""): TimeEntry {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(entryId) as TimeEntry | undefined;

  if (!entry) {
    throw new Error(`stopEntry: no time_entries row with id ${entryId}`);
  }

  const endedAt = new Date();
  const startedAt = new Date(entry.started_at);
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  db.prepare(
    "UPDATE time_entries SET ended_at = ?, duration_seconds = ?, description = ? WHERE id = ?"
  ).run(endedAt.toISOString(), durationSeconds, description, entryId);

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
