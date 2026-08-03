import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { loadSecrets } from "../vault/vault";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILENAME =
  process.env.NODE_ENV === "test" ? "lifetracker.test.db" : "lifetracker.db";
const DB_PATH = path.join(DB_DIR, DB_FILENAME);

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

declare global {
  // eslint-disable-next-line no-var
  var __ltDb: DatabaseSync | undefined;
  // eslint-disable-next-line no-var
  var __ltAdminSeedPromise: Promise<void> | undefined;
}

let _db: DatabaseSync | null = null;

/**
 * Synchronous DB setup: open the file, run migrations, seed default domains.
 * No Vault involved here — this can run immediately at module load, same as
 * it did before Vault was introduced.
 */
function initDb(): DatabaseSync {
  if (_db) return _db;

  const instance = globalThis.__ltDb ?? new DatabaseSync(DB_PATH);
  if (process.env.NODE_ENV !== "production") globalThis.__ltDb = instance;

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

  const timeEntriesColumns = instance
    .prepare("PRAGMA table_info(time_entries)")
    .all() as { name: string }[];

  const hasDescription = timeEntriesColumns.some(
    (col) => col.name === "description"
  );
  if (!hasDescription) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN description TEXT");
  }

  const hasFrr = timeEntriesColumns.some((col) => col.name === "frr");
  if (!hasFrr) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN frr INTEGER");
  }

  const hasPoa = timeEntriesColumns.some((col) => col.name === "poa");
  if (!hasPoa) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN poa INTEGER");
  }

  const hasEndReason = timeEntriesColumns.some((col) => col.name === "end_reason");
  if (!hasEndReason) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN end_reason TEXT");
  }

  const hasFlowRating = timeEntriesColumns.some((col) => col.name === "flow_rating");
  if (!hasFlowRating) {
    instance.exec("ALTER TABLE time_entries ADD COLUMN flow_rating INTEGER");
  }

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

// Synchronous handle — same shape as before Vault was introduced.
// No Proxy trickery needed once getDb() is sync again.
const db: DatabaseSync = initDb();

/**
 * Async, Vault-dependent: seed the admin user if the users table is empty.
 * Cached on a global promise so it only ever runs once per process,
 * regardless of how many callers await it concurrently.
 */
export function ensureAdminSeeded(): Promise<void> {
  if (globalThis.__ltAdminSeedPromise) return globalThis.__ltAdminSeedPromise;

  globalThis.__ltAdminSeedPromise = (async () => {
    const userCountRow = db.prepare("SELECT COUNT(*) as c FROM users").get() as
      | { c: number }
      | undefined;

    if (userCountRow && userCountRow.c > 0) return; // already seeded

    const secrets = await loadSecrets();
    const email = secrets.ADMIN_EMAIL;
    const password = secrets.ADMIN_PASSWORD;

    if (email && password) {
      const salt = randomBytes(16).toString("hex");
      const hash = scryptSync(password, salt, 64).toString("hex");
      db.prepare(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)"
      ).run(email, `${salt}:${hash}`, new Date().toISOString());
    }
  })();

  return globalThis.__ltAdminSeedPromise;
}

export type Domain = { id: number; name: string; color: string };
export type User = { id: number; email: string; password_hash: string; created_at: string };
export type Session = { token: string; user_id: number; expires_at: string };
export type EndReason =
  | "natural_completion"
  | "blocker"
  | "switched_early"
  | "sleep"
  | "forced_stop";

const VALID_END_REASONS: ReadonlySet<string> = new Set([
  "natural_completion",
  "blocker",
  "switched_early",
  "sleep",
  "forced_stop",
]);

export type TimeEntry = {
  id: number;
  domain_id: number;
  started_at: string;
  ended_at: string | null;
  description: string | null;
  duration_seconds: number | null;
  frr: number | null;
  poa: string | null;
  end_reason: EndReason | null;
  flow_rating: number | null;
};

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function getDomains(): Domain[] {
  const rows = db.prepare("SELECT * FROM domains ORDER BY id").all() as Domain[];
  return toPlain(rows);
}

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function verifyPassword(email: string, password: string): User | null {
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as User | undefined;

  if (!user) return null;

  const [salt, storedHash] = user.password_hash.split(":");
  const attemptHash = scryptSync(password, salt, 64).toString("hex");

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

// Vault-dependent only for the "first ever run, no users yet" case —
// ensureAdminSeeded() is a cached no-op after the first call.
export async function getSessionUser(token: string): Promise<User | null> {
  await ensureAdminSeeded();

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

const POA_FRR_ELIGIBLE_DOMAINS = new Set(["Builder", "Learner"]);

function isEligibleForScoring(domainId: number): boolean {
  const domain = db
    .prepare("SELECT name FROM domains WHERE id = ?")
    .get(domainId) as { name: string } | undefined;
  return domain ? POA_FRR_ELIGIBLE_DOMAINS.has(domain.name) : false;
}

export function stopEntry(
  entryId: number,
  description: string = "",
  frr: number | null = null
): TimeEntry {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(entryId) as TimeEntry | undefined;

  if (!entry) {
    throw new Error(`stopEntry: no time_entries row with id ${entryId}`);
  }

  const eligible = isEligibleForScoring(entry.domain_id);
  const frrToStore = eligible ? frr : null;

  const endedAt = new Date();
  const startedAt = new Date(entry.started_at);
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );

  db.prepare(
    "UPDATE time_entries SET ended_at = ?, duration_seconds = ?, description = ?, frr = ? WHERE id = ?"
  ).run(endedAt.toISOString(), durationSeconds, description, frrToStore, entryId);

  return toPlain(
    db.prepare("SELECT * FROM time_entries WHERE id = ?").get(entryId) as TimeEntry
  );
}

export function setEntryPoa(entryId: number, poa: string | null): TimeEntry {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(entryId) as TimeEntry | undefined;

  if (!entry) {
    throw new Error(`setEntryPoa: no time_entries row with id ${entryId}`);
  }

  const eligible = isEligibleForScoring(entry.domain_id);
  const poaToStore = eligible && poa && poa.trim().length > 0 ? poa.trim() : null;

  db.prepare("UPDATE time_entries SET poa = ? WHERE id = ?").run(poaToStore, entryId);

  return toPlain(
    db.prepare("SELECT * FROM time_entries WHERE id = ?").get(entryId) as TimeEntry
  );
}

export function setEntryFlowMeta(
  entryId: number,
  endReason: EndReason | null,
  flowRating: number | null
): TimeEntry {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(entryId) as TimeEntry | undefined;

  if (!entry) {
    throw new Error(`setEntryFlowMeta: no time_entries row with id ${entryId}`);
  }

  const reasonToStore =
    endReason && VALID_END_REASONS.has(endReason) ? endReason : null;

  const ratingToStore =
    typeof flowRating === "number" && flowRating >= 0 && flowRating <= 3
      ? Math.round(flowRating)
      : null;

  db.prepare(
    "UPDATE time_entries SET end_reason = ?, flow_rating = ? WHERE id = ?"
  ).run(reasonToStore, ratingToStore, entryId);

  return toPlain(
    db.prepare("SELECT * FROM time_entries WHERE id = ?").get(entryId) as TimeEntry
  );
}

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

export type DomainAnalytics = {
  domain_id: number;
  domain_name: string;
  domain_color: string;
  today_seconds: number;
  yesterday_seconds: number;
  trailing_avg_seconds: number;
  vs_yesterday_pct: number | null;
  vs_trailing_avg_pct: number | null;
};

export type Analytics = {
  domains: DomainAnalytics[];
  today_total: number;
  yesterday_total: number;
  trailing_avg_total: number;
};

export function getAnalytics(): Analytics {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const yesterdayStart = new Date(startOfToday.getTime() - 1 * DAY_MS);
  const trailingStart = new Date(startOfToday.getTime() - 8 * DAY_MS);

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
        today_seconds: 0,
        yesterday_seconds: 0,
        trailing_sum: 0,
      },
    ])
  );

  for (const row of rows) {
    const entry = perDomain.get(row.domain_id);
    if (!entry) continue;

    const started = new Date(row.started_at).getTime();
    const seconds = row.duration_seconds ?? 0;

    if (started >= startOfToday.getTime()) {
      entry.today_seconds += seconds;
    } else if (started >= yesterdayStart.getTime() && started < startOfToday.getTime()) {
      entry.yesterday_seconds += seconds;
    } else if (started >= trailingStart.getTime() && started < yesterdayStart.getTime()) {
      entry.trailing_sum += seconds;
    }
  }

  let today_total = 0;
  let yesterday_total = 0;
  let trailing_sum_total = 0;

  const domainAnalytics: DomainAnalytics[] = [];
  for (const v of perDomain.values()) {
    const trailing_avg_seconds = v.trailing_sum / 7;

    today_total += v.today_seconds;
    yesterday_total += v.yesterday_seconds;
    trailing_sum_total += v.trailing_sum;

    domainAnalytics.push({
      domain_id: v.domain_id,
      domain_name: v.domain_name,
      domain_color: v.domain_color,
      today_seconds: v.today_seconds,
      yesterday_seconds: v.yesterday_seconds,
      trailing_avg_seconds,
      vs_yesterday_pct:
        v.yesterday_seconds > 0
          ? ((v.today_seconds - v.yesterday_seconds) / v.yesterday_seconds) * 100
          : null,
      vs_trailing_avg_pct:
        trailing_avg_seconds > 0
          ? ((v.today_seconds - trailing_avg_seconds) / trailing_avg_seconds) * 100
          : null,
    });
  }

  return {
    domains: domainAnalytics,
    today_total,
    yesterday_total,
    trailing_avg_total: trailing_sum_total / 7,
  };
}