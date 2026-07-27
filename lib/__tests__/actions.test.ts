import { describe, it, expect, vi } from 'vitest';
import { startEntryAction, stopEntryAction } from '../actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('Server Actions Integration', () => {
  it('updates entry with description via server action', async () => {
    const started = await startEntryAction(1); // domain id 1 ("Coding") from the seed
    const result = await stopEntryAction(started.id, 'Integration test note');

    expect(result).toHaveProperty('duration_seconds');
    expect(result.description).toBe('Integration test note');
  });
});