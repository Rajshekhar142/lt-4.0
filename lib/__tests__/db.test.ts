import { describe, it, expect, beforeEach } from 'vitest';
import { startEntry, stopEntry, getHistory, db } from '../db';

describe('Time Tracker Database with Notes', () => {
  beforeEach(() => {
    // Clear entries before each test to prevent ID collisions or stale data
    db.prepare('DELETE FROM time_entries').run();
  });

  it('saves and retrieves an entry with a description', () => {
    // 1. Start timer for domain 1
    const entry = startEntry(1);
    expect(entry).toBeDefined();
    expect(entry.id).toBeDefined();

    // 2. Stop timer and attach note
    stopEntry(entry.id, 'Completed feature implementation test');

    // 3. Retrieve history (passing 7 days to ensure wider window)
    const history = getHistory(7);
    const loggedEntry = history.find((e) => e.id === entry.id);

    // 4. Assert entry presence and note value
    expect(loggedEntry).toBeDefined();
    expect(loggedEntry?.description).toBe('Completed feature implementation test');
  });
});