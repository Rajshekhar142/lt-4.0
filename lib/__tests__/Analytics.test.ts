import { describe, it, expect, beforeEach } from 'vitest';
import { db, getAnalytics } from '../db';

describe('getAnalytics', () => {
  beforeEach(() => {
    // Clear entries before each test — same isolation pattern as
    // db.test.ts. Vitest runs with NODE_ENV=test, so this is already
    // hitting lifetracker.test.db, never your real tracked history.
    db.prepare('DELETE FROM time_entries').run();
  });

  function insertEntry(domainId: number, daysAgo: number, seconds: number) {
    const start = new Date();
    start.setHours(10, 0, 0, 0);
    start.setDate(start.getDate() - daysAgo);
    const end = new Date(start.getTime() + seconds * 1000);

    db.prepare(
      `INSERT INTO time_entries (domain_id, started_at, ended_at, duration_seconds)
       VALUES (?, ?, ?, ?)`
    ).run(domainId, start.toISOString(), end.toISOString(), seconds);
  }

  it('computes correct deltas vs. previous day and trailing average', () => {
    const domains = db.prepare('SELECT * FROM domains ORDER BY id').all() as { id: number }[];
    const codingId = domains[0].id;

    insertEntry(codingId, 1, 7200); // yesterday: 2h
    insertEntry(codingId, 2, 3600); // day before: 1h
    for (let d = 3; d <= 9; d++) insertEntry(codingId, d, 1800); // trailing week: 30min/day

    const result = getAnalytics();
    const coding = result.domains.find((d) => d.domain_id === codingId);

    expect(coding).toBeDefined();
    expect(coding!.yesterday_seconds).toBe(7200);
    expect(coding!.day_before_seconds).toBe(3600);
    expect(coding!.trailing_avg_seconds).toBe(1800);
    expect(coding!.vs_previous_day_pct).toBe(100); // 2h is +100% vs 1h
    expect(coding!.vs_trailing_avg_pct).toBe(300); // 2h is +300% vs 30min avg
  });

  it('returns null (not NaN/Infinity) when day_before was zero', () => {
    const domains = db.prepare('SELECT * FROM domains ORDER BY id').all() as { id: number }[];
    const codingId = domains[0].id;

    insertEntry(codingId, 1, 3600); // yesterday: 1h
    // nothing 2 days ago — day_before_seconds stays 0

    const result = getAnalytics();
    const coding = result.domains.find((d) => d.domain_id === codingId);

    expect(coding!.day_before_seconds).toBe(0);
    expect(coding!.vs_previous_day_pct).toBeNull();
  });

  it('returns null for a domain with zero activity entirely', () => {
    const domains = db.prepare('SELECT * FROM domains ORDER BY id').all() as {
      id: number;
      name: string;
    }[];

    // Deliberately insert nothing for any domain
    const result = getAnalytics();

    for (const d of result.domains) {
      expect(d.yesterday_seconds).toBe(0);
      expect(d.vs_previous_day_pct).toBeNull();
      expect(d.vs_trailing_avg_pct).toBeNull();
    }
    expect(result.yesterday_total).toBe(0);
  });

  it('totals across domains match the sum of individual domains', () => {
    const domains = db.prepare('SELECT * FROM domains ORDER BY id').all() as { id: number }[];
    const [codingId, chessId] = domains.map((d) => d.id);

    insertEntry(codingId, 1, 3600);
    insertEntry(chessId, 1, 1800);

    const result = getAnalytics();
    expect(result.yesterday_total).toBe(3600 + 1800);
  });
});
