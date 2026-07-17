// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting } from 'obsidian';
import HistoryManagerModal from '../src/modals/history-manager-modal';
import moment from 'moment';

describe('HistoryManagerModal', () => {
  let mockApp: any;
  let plugin: any;
  let modal: HistoryManagerModal;

  beforeEach(() => {
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    Setting.resetInstances();
    mockApp = {};

    plugin = {
      historyManager: {
        getEntriesForManagement: vi.fn(async () => [
          { key: 'tomorrow', display: 'Tomorrow', count: 5, lastUsed: Date.now() },
          { key: 'next friday', display: 'Next Friday', count: 2, lastUsed: Date.now() - 1000 },
        ]),
        removeEntry: vi.fn(async () => {}),
        clearHistory: vi.fn(async () => {}),
      },
    };

    modal = new HistoryManagerModal(mockApp, plugin);
  });

  // Uses the *last* matching instance: render() is called again on every
  // click (arming "Clear all", removing an entry, reopening the modal),
  // which pushes new Setting instances without clearing the old ones --
  // the most recent instance is the one reflecting current state.
  function findSetting(name: string): Setting {
    const found = [...Setting.instances].reverse().find(s => s.nameText === name);
    if (!found) throw new Error(`No Setting found with name "${name}" (have: ${Setting.instances.map(s => s.nameText).join(', ')})`);
    return found;
  }

  it('renders a row per history entry with its display text and usage info', async () => {
    await modal.onOpen();
    // flush the async render() triggered by onOpen()
    await new Promise(resolve => setTimeout(resolve, 0));

    const tomorrow = findSetting('Tomorrow');
    expect(tomorrow.descText).toContain('5 times');
    const nextFriday = findSetting('Next Friday');
    expect(nextFriday.descText).toContain('2 times');
  });

  it('removes only the clicked entry and re-renders without it', async () => {
    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));

    const tomorrowSetting = findSetting('Tomorrow');
    const deleteButton = tomorrowSetting.components[0];
    await deleteButton.clickHandler();

    expect(plugin.historyManager.removeEntry).toHaveBeenCalledWith('tomorrow');
    // After removal, getEntriesForManagement is mocked to still return both
    // (it's a static mock), but we're verifying the *call*, which is what
    // actually deletes the entry in the real HistoryManager.
  });

  it('shows an empty-state message when there is no history', async () => {
    plugin.historyManager.getEntriesForManagement = vi.fn(async () => []);
    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(Setting.instances.some(s => s.nameText === 'Clear all history')).toBe(false);
  });

  it('requires two clicks on "Clear all" before actually clearing (regression against accidental wipe)', async () => {
    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));

    const clearSetting = findSetting('Clear all history');
    const clearButton = clearSetting.components[0];

    // First click: arms it, does not clear yet.
    await clearButton.clickHandler();
    expect(plugin.historyManager.clearHistory).not.toHaveBeenCalled();

    // Second click (on the re-rendered "armed" button): actually clears.
    const armedSetting = findSetting('Clear all history');
    const armedButton = armedSetting.components[0];
    await armedButton.clickHandler();
    expect(plugin.historyManager.clearHistory).toHaveBeenCalled();
  });

  it('resets the "armed" clear-all confirmation state each time the modal is reopened', async () => {
    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));
    const clearButton = findSetting('Clear all history').components[0];
    await clearButton.clickHandler(); // arm it
    expect(findSetting('Clear all history').descText).toContain('Click again to confirm');

    Setting.resetInstances();
    await modal.onOpen(); // reopen
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(findSetting('Clear all history').descText).not.toContain('Click again to confirm');
  });

  it('disarms "Clear all" when an individual entry is removed instead (regression: an unrelated later "Clear all" click would otherwise wipe everything unconfirmed)', async () => {
    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));

    // Arm "Clear all" first...
    await findSetting('Clear all history').components[0].clickHandler();
    expect(findSetting('Clear all history').descText).toContain('Click again to confirm');

    // ...then change their mind and delete a single entry instead.
    await findSetting('Tomorrow').components[0].clickHandler();

    // "Clear all" must be back to its unarmed state, not primed to wipe
    // everything on the next (unrelated) click.
    expect(findSetting('Clear all history').descText).not.toContain('Click again to confirm');
    expect(plugin.historyManager.clearHistory).not.toHaveBeenCalled();
  });

  it('fetches entries before touching the DOM, so the modal never flashes an empty/header-only state (regression)', async () => {
    const callOrder: string[] = [];
    plugin.historyManager.getEntriesForManagement = vi.fn(async () => {
      callOrder.push('fetch');
      return [{ key: 'tomorrow', display: 'Tomorrow', count: 1, lastUsed: Date.now() }];
    });
    const emptySpy = vi.spyOn((modal as any).contentEl, 'empty').mockImplementation(() => {
      callOrder.push('empty');
    });

    await modal.onOpen();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(callOrder).toEqual(['fetch', 'empty']);
    emptySpy.mockRestore();
  });
});
