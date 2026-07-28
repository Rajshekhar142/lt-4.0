import { db, getDomains } from "../lib/db";

function seedDatabase() {
  console.log("🌱 Seeding 8 days of sample time entries...");

  const domains = getDomains();
  if (domains.length === 0) {
    console.error("No domains found. Run the app once first or initialize the DB schema.");
    process.exit(1);
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const DAY_MS = 24 * 60 * 60 * 1000;

  const insert = db.prepare(
    "INSERT INTO time_entries (domain_id, started_at, ended_at, description, duration_seconds) VALUES (?, ?, ?, ?, ?)"
  );

  // Clear existing time entries first (optional)
  db.exec("DELETE FROM time_entries;");

  // Domain IDs: Coding (0), Chess (1), Reading (2)
  const codingId = domains[0]?.id ?? 1;
  const chessId = domains[1]?.id ?? 2;
  const readingId = domains[2]?.id ?? 3;

  // Seed entries across 8 days (Today = day 0, Yesterday = day 1, Days -2 to -7 = trailing avg)
  for (let day = 7; day >= 0; day--) {
    const dayStart = new Date(startOfToday.getTime() - day * DAY_MS);

    // 1. Coding entry
    const codingStart = new Date(dayStart.getTime() + 10 * 3600 * 1000); // 10:00 AM
    const codingDuration = day === 0 ? 7200 : 10800 + Math.floor(Math.random() * 3600); // 2 hrs today, ~3-4 hrs past days
    const codingEnd = new Date(codingStart.getTime() + codingDuration * 1000);
    insert.run(codingId, codingStart.toISOString(), codingEnd.toISOString(), "Feature work & fixes", codingDuration);

    // 2. Chess entry
    const chessStart = new Date(dayStart.getTime() + 15 * 3600 * 1000); // 3:00 PM
    const chessDuration = day === 0 ? 1800 : 3600; // 30 mins today, 1 hr past days
    const chessEnd = new Date(chessStart.getTime() + chessDuration * 1000);
    insert.run(chessId, chessStart.toISOString(), chessEnd.toISOString(), "Rapid games & tactics", chessDuration);

    // 3. Reading entry
    const readingStart = new Date(dayStart.getTime() + 20 * 3600 * 1000); // 8:00 PM
    const readingDuration = 2700; // 45 mins
    const readingEnd = new Date(readingStart.getTime() + readingDuration * 1000);
    insert.run(readingId, readingStart.toISOString(), readingEnd.toISOString(), "Tech blogs / book chapter", readingDuration);
  }

  console.log("✅ Successfully seeded 8 days of sample data into data/lifetracker.db!");
}

seedDatabase();
