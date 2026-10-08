import { logDrill, logMock } from "./lib/analytics/db";

async function main() {
  console.log("Seeding analytics drill and mock data...");

  // Seed Drills
  logDrill("qa_arithmetic", "QA", 20, 18);
  logDrill("qa_algebra", "QA", 16, 13);
  logDrill("varc_rc_foundations", "VARC", 18, 15);
  logDrill("dilr_arrangements", "DILR", 20, 14);
  logDrill("dilr_tables", "DILR", 15, 10);
  logDrill("varc_para_summary", "VARC", 16, 12);

  // Seed Mocks
  logMock("SIMCAT 1", "2026-08-15", 28, 22, 24);
  logMock("SIMCAT 2", "2026-08-30", 34, 26, 31);
  logMock("AIMCAT 1", "2026-09-15", 31, 30, 36);
  logMock("AIMCAT 2", "2026-09-28", 39, 34, 42);

  console.log("Seeding complete!");
}

main().catch((err) => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
