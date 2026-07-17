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

  it('loads valid history data normally', async () => {
    const plugin = makePlugin({ read: vi.fn(async () => JSON.stringify({ tomorrow: 3 })) });
    manager = new HistoryManager(plugin);

    await manager.loadHistory();

    expect((manager as any).history).toEqual({ tomorrow: 3 });
  });
});
