import { describe, it, expect, beforeEach } from "vitest";
import { db, getAnalytics } from "../db";

describe("getAnalytics - Today vs. Yesterday & 7-Day Rolling Avg", () => {
  beforeEach(() => {
    // Wipe test database state before each run
    db.exec("DELETE FROM time_entries;");
  });

  it("calculates today vs yesterday and trailing 7-day average correctly", () => {
    const domains = db.prepare("SELECT id FROM domains ORDER BY id").all() as { id: number }[];
    const domainId = domains[0].id;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const DAY_MS = 24 * 60 * 60 * 1000;

    const insertStmt = db.prepare(
      "INSERT INTO time_entries (domain_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)"
    );

    // Seed Data Setup:
    // Day 0 (Today): 3600 seconds (1 hr)
    // Day -1 (Yesterday): 1800 seconds (0.5 hr) -> expecting +100% vs yesterday
    // Days -2 to -8 (7 days prior to yesterday): 3600 seconds each day
    // Trailing 7-day sum = 7 * 3600 = 25200 seconds -> Trailing avg = 3600 seconds
    // Expecting 0% vs trailing average

    // 1. Seed Today
    const todayTime = new Date(startOfToday.getTime() + 2 * 60 * 60 * 1000).toISOString();
    insertStmt.run(domainId, todayTime, todayTime, 3600);

    // 2. Seed Yesterday (Day -1)
    const yesterdayTime = new Date(startOfToday.getTime() - 1 * DAY_MS + 2 * 60 * 60 * 1000).toISOString();
    insertStmt.run(domainId, yesterdayTime, yesterdayTime, 1800);

    // 3. Seed Prior 7 Days (Days -2 through -8)
    for (let day = 2; day <= 8; day++) {
      const pastTime = new Date(startOfToday.getTime() - day * DAY_MS + 2 * 60 * 60 * 1000).toISOString();
      insertStmt.run(domainId, pastTime, pastTime, 3600);
    }

    const analytics = getAnalytics();

    expect(analytics.today_total).toBe(3600);
    expect(analytics.yesterday_total).toBe(1800);
    expect(analytics.trailing_avg_total).toBe(3600);

    const domainAnalytics = analytics.domains.find((d) => d.domain_id === domainId);
    expect(domainAnalytics).toBeDefined();

    if (domainAnalytics) {
      expect(domainAnalytics.today_seconds).toBe(3600);
      expect(domainAnalytics.yesterday_seconds).toBe(1800);
      expect(domainAnalytics.trailing_avg_seconds).toBe(3600);

      // (3600 - 1800) / 1800 * 100 = +100%
      expect(domainAnalytics.vs_yesterday_pct).toBeCloseTo(100);

      // (3600 - 3600) / 3600 * 100 = 0%
      expect(domainAnalytics.vs_trailing_avg_pct).toBeCloseTo(0);
    }
  });

  it("handles null percentage deltas when yesterday or average data is zero", () => {
    const domains = db.prepare("SELECT id FROM domains ORDER BY id").all() as { id: number }[];
    const domainId = domains[0].id;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const insertStmt = db.prepare(
      "INSERT INTO time_entries (domain_id, started_at, ended_at, duration_seconds) VALUES (?, ?, ?, ?)"
    );

    // Only seed today, zero entries for past days
    const todayTime = new Date(startOfToday.getTime() + 1 * 60 * 60 * 1000).toISOString();
    insertStmt.run(domainId, todayTime, todayTime, 1200);

    const analytics = getAnalytics();
    const domainAnalytics = analytics.domains.find((d) => d.domain_id === domainId);

    expect(domainAnalytics?.vs_yesterday_pct).toBeNull();
    expect(domainAnalytics?.vs_trailing_avg_pct).toBeNull();
  });
});