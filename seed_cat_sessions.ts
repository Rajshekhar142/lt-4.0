import { DatabaseSync } from "node:sqlite";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "lifetracker.db");
const db = new DatabaseSync(DB_PATH);

// 1. Fetch domain IDs
const learner = db
  .prepare("SELECT id FROM domains WHERE name = 'Learner'")
  .get() as { id: number } | undefined;

const builder = db
  .prepare("SELECT id FROM domains WHERE name = 'Builder'")
  .get() as { id: number } | undefined;

if (!learner) {
  console.error("Learner domain not found. Ensure DB is initialized first.");
  process.exit(1);
}

const learnerId = learner.id;
const builderId = builder ? builder.id : learnerId;

// Helper to compute timestamps
const now = Date.now();
const daysAgo = (days: number, offsetHours: number = 0) =>
  new Date(now - days * 24 * 3600 * 1000 + offsetHours * 3600 * 1000).toISOString();

type SeedEntry = {
  domain_id: number;
  tag: string;
  days_ago: number;
  duration_minutes: number;
  description: string;
  attempted: number | null;
  correct: number | null;
  flow_rating: number | null;
  frr: number | null; // 0 (low friction) to 1 (high friction)
  end_reason: string;
  poa: string | null;
};

const seedSessions: SeedEntry[] = [
  // --------------------------------------------------------------------------
  // Quadrant 1: Bottleneck / Time Sink (High Time, Low Accuracy)
  // High seconds invested, poor accuracy conversion, elevated friction (FRR = 1)
  // --------------------------------------------------------------------------
  {
    domain_id: learnerId,
    tag: "DILR: Circular Arrangement",
    days_ago: 1,
    duration_minutes: 105,
    description: "4 sets attempted, kept getting stuck on negative constraints",
    attempted: 16,
    correct: 3,
    flow_rating: 1,
    frr: 1,
    end_reason: "blocker",
    poa: "Redo constraints mapping without guessing",
  },
  {
    domain_id: learnerId,
    tag: "DILR: Circular Arrangement",
    days_ago: 3,
    duration_minutes: 95,
    description: "2 complex caselet sets from previous year papers",
    attempted: 10,
    correct: 2,
    flow_rating: 1,
    frr: 1,
    end_reason: "forced_stop",
    poa: "Trace case branch logic on paper",
  },
  {
    domain_id: learnerId,
    tag: "DILR: Circular Arrangement",
    days_ago: 6,
    duration_minutes: 110,
    description: "Drilling 8-person facing inward/outward arrangements",
    attempted: 14,
    correct: 4,
    flow_rating: 0,
    frr: 1,
    end_reason: "blocker",
    poa: "Focus on definitive anchor points first",
  },

  // --------------------------------------------------------------------------
  // Quadrant 2: Efficient / Low Drag (Low Time, High Accuracy)
  // Quick sessions, strong conversion, low friction (FRR = 0)
  // --------------------------------------------------------------------------
  {
    domain_id: learnerId,
    tag: "VARC: Para-jumbles",
    days_ago: 2,
    duration_minutes: 30,
    description: "5 sets timed practice, mandatory pair identification",
    attempted: 8,
    correct: 7,
    flow_rating: 3,
    frr: 0,
    end_reason: "natural_completion",
    poa: "Maintain pronoun-antecedent checks",
  },
  {
    domain_id: learnerId,
    tag: "VARC: Para-jumbles",
    days_ago: 5,
    duration_minutes: 25,
    description: "TITA para-jumbles practice set",
    attempted: 6,
    correct: 5,
    flow_rating: 3,
    frr: 0,
    end_reason: "natural_completion",
    poa: null,
  },

  // --------------------------------------------------------------------------
  // Quadrant 3: Mastered / High Yield (High Time, High Accuracy)
  // High volume practice with solid conversion rate
  // --------------------------------------------------------------------------
  {
    domain_id: learnerId,
    tag: "QA: Arithmetic (TSD & Work)",
    days_ago: 2,
    duration_minutes: 80,
    description: "Relative speed, circular tracks, escalators drill",
    attempted: 22,
    correct: 18,
    flow_rating: 3,
    frr: 0,
    end_reason: "natural_completion",
    poa: "Clean ratio shortcuts used throughout",
  },
  {
    domain_id: learnerId,
    tag: "QA: Arithmetic (TSD & Work)",
    days_ago: 4,
    duration_minutes: 75,
    description: "Time and Work efficiency based sets",
    attempted: 20,
    correct: 16,
    flow_rating: 2,
    frr: 0,
    end_reason: "natural_completion",
    poa: "Verify LCM assumption steps",
  },
  {
    domain_id: learnerId,
    tag: "QA: Arithmetic (TSD & Work)",
    days_ago: 8,
    duration_minutes: 90,
    description: "Mixed arithmetic sectional review",
    attempted: 25,
    correct: 21,
    flow_rating: 3,
    frr: 0,
    end_reason: "natural_completion",
    poa: null,
  },

  // --------------------------------------------------------------------------
  // Quadrant 4: Low Exposure / Stalled (Low Time, Low Accuracy)
  // Needs either a commitment or deprioritization
  // --------------------------------------------------------------------------
  {
    domain_id: learnerId,
    tag: "QA: Modern Math (P&C)",
    days_ago: 7,
    duration_minutes: 35,
    description: "Circular permutations and partition method basics",
    attempted: 10,
    correct: 3,
    flow_rating: 1,
    frr: 1,
    end_reason: "switched_early",
    poa: "Re-read fundamentals on de-arrangement formula",
  },

  // --------------------------------------------------------------------------
  // Non-CAT / Qualitative Sessions (No attempted/correct logged)
  // Verifies composite fallback scoring using flow_rating, completion, and POA
  // --------------------------------------------------------------------------
  {
    domain_id: builderId,
    tag: "LifeTracker Infra",
    days_ago: 4,
    duration_minutes: 120,
    description: "Docker compose, SQLite WAL setup, and migrations",
    attempted: null,
    correct: null,
    flow_rating: 3,
    frr: 0,
    end_reason: "natural_completion",
    poa: "Add healthcheck routes in next sprint",
  },
  {
    domain_id: builderId,
    tag: "LifeTracker Infra",
    days_ago: 9,
    duration_minutes: 85,
    description: "Debugging persistent volume permissions",
    attempted: null,
    correct: null,
    flow_rating: 1,
    frr: 1,
    end_reason: "blocker",
    poa: "Audit user UID mapping in container",
  },
];

const insertStmt = db.prepare(`
  INSERT INTO time_entries (
    domain_id,
    tag,
    started_at,
    ended_at,
    duration_seconds,
    description,
    attempted,
    correct,
    flow_rating,
    frr,
    end_reason,
    poa
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

console.log("Seeding CAT quadrant test sessions...");

for (const session of seedSessions) {
  const startedAt = daysAgo(session.days_ago, 0);
  const endedAt = daysAgo(session.days_ago, session.duration_minutes / 60);
  const durationSeconds = session.duration_minutes * 60;

  insertStmt.run(
    session.domain_id,
    session.tag,
    startedAt,
    endedAt,
    durationSeconds,
    session.description,
    session.attempted,
    session.correct,
    session.flow_rating,
    session.frr,
    session.end_reason,
    session.poa
  );
}

// Set initial Prime Focus indicator
db.prepare(
  "INSERT INTO settings (key, value) VALUES ('prime_focus', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
).run("DILR: Circular Arrangement");

console.log(`Successfully seeded ${seedSessions.length} sessions.`);
