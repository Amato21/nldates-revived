// IMPORTANT: This file MUST import setup.ts first to define window.moment
// and stub window.setInterval/clearInterval (HistoryManager's constructor
// starts a periodic cleanup interval).
import './setup';

import { describe, it, expect, vi, afterEach } from 'vitest';
import HistoryManager from '../src/history-manager';
import { logger } from '../src/logger';

function makePlugin(adapterOverrides: Record<string, unknown> = {}) {
  return {
    app: {
      vault: {
        configDir: '.obsidian',
        adapter: {
          exists: vi.fn(async () => true),
          read: vi.fn(async () => '{}'),
          mkdir: vi.fn(async () => {}),
          write: vi.fn(async () => {}),
          ...adapterOverrides,
        },
      },
    },
  } as any;
}

describe('HistoryManager.loadHistory', () => {
  let manager: HistoryManager | undefined;

  afterEach(() => {
    manager?.stopPeriodicCleanup();
    manager = undefined;
    vi.restoreAllMocks();
  });

  it('logs the error instead of silently discarding history when the file is corrupted (regression)', async () => {
    // Reaching the catch block here means an actual anomaly, not "file
    // doesn't exist" -- that case is already handled by the exists() guard.
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const plugin = makePlugin({ read: vi.fn(async () => '{not valid json') });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect(errorSpy).toHaveBeenCalledWith('Error loading history:', expect.objectContaining({ error: expect.any(Error) }));
    expect((manager as any).history).toEqual({});
  });

  it('logs the error when adapter.read() itself rejects', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const plugin = makePlugin({ read: vi.fn(async () => { throw new Error('disk error'); }) });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect(errorSpy).toHaveBeenCalledWith('Error loading history:', expect.objectContaining({ error: expect.any(Error) }));
  });

  it('does not log an error for the normal "file does not exist yet" case', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const plugin = makePlugin({ exists: vi.fn(async () => false) });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect(errorSpy).not.toHaveBeenCalled();
    expect((manager as any).history).toEqual({});
  });

  it('loads valid history data written in the current format', async () => {
    const plugin = makePlugin({ read: vi.fn(async () => JSON.stringify({ tomorrow: { count: 3, lastUsed: 12345 } })) });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect((manager as any).history).toEqual({ tomorrow: { count: 3, lastUsed: 12345 } });
  });

  it('migrates a legacy history file (plain counters) to the current format', async () => {
    const plugin = makePlugin({ read: vi.fn(async () => JSON.stringify({ tomorrow: 3 })) });
    manager = new HistoryManager(plugin);

    const before = Date.now();
    await manager.loadHistory();
    const after = Date.now();

    const entry = (manager as any).history.tomorrow;
    expect(entry.count).toBe(3);
    expect(entry.lastUsed).toBeGreaterThanOrEqual(before);
    expect(entry.lastUsed).toBeLessThanOrEqual(after);
  });

  it('drops a malformed entry instead of carrying it forward', async () => {
    const plugin = makePlugin({ read: vi.fn(async () => JSON.stringify({ tomorrow: 3, broken: { oops: true } })) });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect((manager as any).history.broken).toBeUndefined();
    expect((manager as any).history.tomorrow).toBeDefined();
  });
});

describe('HistoryManager suggestion capitalization (regression)', () => {
  let manager: HistoryManager | undefined;

  afterEach(() => {
    manager?.stopPeriodicCleanup();
    manager = undefined;
  });

  it('normalizeSuggestion() title-cases every word instead of only the first character of the whole string', () => {
    const plugin = makePlugin({ exists: vi.fn(async () => false) });
    manager = new HistoryManager(plugin);
    const normalizeSuggestion = (manager as any).normalizeSuggestion.bind(manager);
    // History keys are stored fully lowercase (recordSelection()), so this
    // used to produce "Next friday" -- only the first letter capitalized --
    // inconsistent with what other suggestion sources show for the same
    // phrase in the same dropdown ("Next Friday").
    expect(normalizeSuggestion('next friday')).toBe('Next Friday');
    expect(normalizeSuggestion('tomorrow')).toBe('Tomorrow');
  });

  it('getTopSuggestionsSync() returns properly title-cased multi-word suggestions after recordSelection()', async () => {
    const plugin = makePlugin({ exists: vi.fn(async () => false) });
    manager = new HistoryManager(plugin);
    await manager.recordSelection('Next Friday');
    const suggestions = manager.getTopSuggestionsSync(10);
    expect(suggestions).toContain('Next Friday');
    expect(suggestions).not.toContain('Next friday');
  });
});

describe('HistoryManager recency-weighted ranking', () => {
  let manager: HistoryManager | undefined;
  const DAY_MS = 24 * 60 * 60 * 1000;

  afterEach(() => {
    manager?.stopPeriodicCleanup();
    manager = undefined;
    vi.useRealTimers();
  });

  it('computeScore() halves an entry\'s weight after one half-life (30 days) of inactivity', () => {
    const plugin = makePlugin({ exists: vi.fn(async () => false) });
    manager = new HistoryManager(plugin);
    const computeScore = (manager as any).computeScore.bind(manager);
    const now = Date.now();
    const entry = { count: 10, lastUsed: now };

    expect(computeScore(entry, now)).toBeCloseTo(10, 5); // no age -> full weight
    expect(computeScore(entry, now + 30 * DAY_MS)).toBeCloseTo(5, 5); // one half-life -> half weight
    expect(computeScore(entry, now + 60 * DAY_MS)).toBeCloseTo(2.5, 5); // two half-lives -> quarter weight
  });

  it('ranks a recently-used suggestion above an old, higher-count one once enough time has passed (regression: used to be pure frequency)', async () => {
    vi.useFakeTimers();
    try {
      const plugin = makePlugin({ exists: vi.fn(async () => false) });
      manager = new HistoryManager(plugin);

      // "old favorite" gets selected many times...
      for (let i = 0; i < 20; i++) {
        await manager.recordSelection('old favorite');
      }

      // ...then 90 days pass with no further use (past the 30-day half-life)...
      vi.advanceTimersByTime(90 * DAY_MS);

      // ...and a different suggestion gets picked just 3 times, recently.
      for (let i = 0; i < 3; i++) {
        await manager.recordSelection('new habit');
      }

      const suggestions = manager.getTopSuggestionsSync(10);
      expect(suggestions.indexOf('New Habit')).toBeLessThan(suggestions.indexOf('Old Favorite'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-selecting a stale entry refreshes its recency and restores its ranking', async () => {
    vi.useFakeTimers();
    try {
      const plugin = makePlugin({ exists: vi.fn(async () => false) });
      manager = new HistoryManager(plugin);

      for (let i = 0; i < 20; i++) {
        await manager.recordSelection('old favorite');
      }
      vi.advanceTimersByTime(90 * DAY_MS);
      for (let i = 0; i < 3; i++) {
        await manager.recordSelection('new habit');
      }
      // Confirm it actually fell behind first (same setup as the previous test).
      let suggestions = manager.getTopSuggestionsSync(10);
      expect(suggestions.indexOf('New Habit')).toBeLessThan(suggestions.indexOf('Old Favorite'));

      // Selecting the stale one again should refresh it back to the top.
      await manager.recordSelection('old favorite');
      suggestions = manager.getTopSuggestionsSync(10);
      expect(suggestions.indexOf('Old Favorite')).toBeLessThan(suggestions.indexOf('New Habit'));
    } finally {
      vi.useRealTimers();
    }
  });
});
