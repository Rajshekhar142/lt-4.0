import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

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

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL
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
    { name: "Coding", color: "#ff8552" },
    { name: "Chess", color: "#6c8ae4" },
    { name: "Reading", color: "#4caf7d" },
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

  // Seed exactly one admin account from env vars, once. There is no
  // signup route anywhere in the app — this is the only way a user ever
  // gets created, so your real password never sits in source code or git
  // history. Set ADMIN_EMAIL / ADMIN_PASSWORD before first boot; if
  // they're unset, no account gets created and login stays impossible
  // (fails safe, doesn't crash).
  const userCountRow = instance.prepare("SELECT COUNT(*) as c FROM users").get() as
    | { c: number }
    | undefined;

  if (!userCountRow || userCountRow.c === 0) {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (email && password) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      instance
        .prepare(
          "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)"
        )
        .run(email, `${salt}:${hash}`, new Date().toISOString());
    }
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
export type User = { id: number; email: string; password_hash: string; created_at: string };
export type Session = { token: string; user_id: number; expires_at: string };
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

// --- Auth ---
// No signup route exists — this whole section only ever touches the one
// account seeded from ADMIN_EMAIL/ADMIN_PASSWORD above. "Multi-user
// capable" means the schema doesn't assume a single hardcoded user id
// anywhere, so a second account could be added by hand later without a
// schema change — not that anyone can create one through the UI today.

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function verifyPassword(email: string, password: string): User | null {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as User | undefined;

  if (!user) return null;

  const [salt, storedHash] = user.password_hash.split(":");
  const attemptHash = scryptSync(password, salt, 64).toString("hex");

  // timingSafeEqual avoids leaking *how much* of the hash matched via
  // response-time differences — a plain === comparison here would be a
  // real (if minor) timing side-channel on a login endpoint.
  const a = Buffer.from(attemptHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return toPlain(user);
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).run(token, userId, expiresAt);

  return token;
}

export function getSessionUser(token: string): User | null {
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > ?`
    )
    .get(token, new Date().toISOString()) as User | undefined;

  return row ? toPlain(row) : null;
}

export function deleteSession(token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
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

export type DomainAnalytics = {
  domain_id: number;
  domain_name: string;
  domain_color: string;
  yesterday_seconds: number;
  day_before_seconds: number;
  trailing_avg_seconds: number;
  // null when there's nothing meaningful to divide by (e.g. day_before
  // was 0) — showing "+infinity%" or "0%" in that case would be noise,
  // not signal, so the UI should just skip the comparison entirely.
  vs_previous_day_pct: number | null;
  vs_trailing_avg_pct: number | null;
};

export type Analytics = {
  domains: DomainAnalytics[];
  yesterday_total: number;
  day_before_total: number;
  trailing_avg_total: number;
};

// "Yesterday vs the day before" alone is noisy — a single arbitrary prior
// day tells you little (what if THAT day was unusually slow?). Pairing it
// with "yesterday vs your trailing 7-day average" (the 7 days ending the
// day before that comparison day, so it never includes yesterday itself)
// gives a baseline that says whether yesterday was actually good or bad
// relative to your normal pace, not just relative to one data point.
export function getAnalytics(): Analytics {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const yesterdayStart = new Date(startOfToday.getTime() - 1 * DAY_MS);
  const dayBeforeStart = new Date(startOfToday.getTime() - 2 * DAY_MS);
  const trailingStart = new Date(startOfToday.getTime() - 9 * DAY_MS); // 7 days before day-before-yesterday

  const rows = db
    .prepare(
      `SELECT te.domain_id, te.started_at, te.duration_seconds
       FROM time_entries te
       WHERE te.started_at >= ? AND te.ended_at IS NOT NULL`
    )
    .all(trailingStart.toISOString()) as {
    domain_id: number;
    started_at: string;
    duration_seconds: number | null;
  }[];

  const domains = getDomains();
  const perDomain = new Map(
    domains.map((d) => [
      d.id,
      {
        domain_id: d.id,
        domain_name: d.name,
        domain_color: d.color,
        yesterday_seconds: 0,
        day_before_seconds: 0,
        trailing_sum: 0,
      },
    ])
  );

  for (const row of rows) {
    const entry = perDomain.get(row.domain_id);
    if (!entry) continue;

    const started = new Date(row.started_at).getTime();
    const seconds = row.duration_seconds ?? 0;

    if (started >= yesterdayStart.getTime() && started < startOfToday.getTime()) {
      entry.yesterday_seconds += seconds;
    } else if (started >= dayBeforeStart.getTime() && started < yesterdayStart.getTime()) {
      entry.day_before_seconds += seconds;
    } else if (started >= trailingStart.getTime() && started < dayBeforeStart.getTime()) {
      entry.trailing_sum += seconds;
    }
  }

  let yesterday_total = 0;
  let day_before_total = 0;
  let trailing_sum_total = 0;

  const domainAnalytics: DomainAnalytics[] = [];
  for (const v of perDomain.values()) {
    const trailing_avg_seconds = v.trailing_sum / 7;

    yesterday_total += v.yesterday_seconds;
    day_before_total += v.day_before_seconds;
    trailing_sum_total += v.trailing_sum;

    domainAnalytics.push({
      domain_id: v.domain_id,
      domain_name: v.domain_name,
      domain_color: v.domain_color,
      yesterday_seconds: v.yesterday_seconds,
      day_before_seconds: v.day_before_seconds,
      trailing_avg_seconds,
      vs_previous_day_pct:
        v.day_before_seconds > 0
          ? ((v.yesterday_seconds - v.day_before_seconds) / v.day_before_seconds) * 100
          : null,
      vs_trailing_avg_pct:
        trailing_avg_seconds > 0
          ? ((v.yesterday_seconds - trailing_avg_seconds) / trailing_avg_seconds) * 100
          : null,
    });
  }

  return {
    domains: domainAnalytics,
    yesterday_total,
    day_before_total,
    trailing_avg_total: trailing_sum_total / 7,
  };
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
