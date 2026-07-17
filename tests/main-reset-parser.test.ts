// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// resetParser() is tested by invoking the real prototype method against a
// minimal fake `this`, instead of constructing a full plugin instance --
// avoids needing to mock the entire Obsidian Plugin lifecycle (workspace,
// vault, commands, etc.) for a method that only touches
// this.settings/this.parser/this.contextAnalyzer.
describe('NaturalLanguageDates.resetParser (regression: Notice never fired -- used app.notifications, which doesn\'t exist)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../src/parser');
    vi.resetModules();
  });

  it('shows a Notice when the configured languages fail but the English fallback succeeds', async () => {
    vi.doMock('../src/parser', () => ({
      // A real `function` (not an arrow function passed to mockImplementation)
      // so `new NLDParser(...)` follows normal JS constructor semantics.
      default: vi.fn(function (languages: string[]) {
        if (languages.length === 1 && languages[0] === 'en') {
          return { languages, getParsedDate: vi.fn() };
        }
        throw new Error('boom: unsupported language configuration');
      }),
    }));

    const { default: NaturalLanguageDates } = await import('../src/main');
    const { Notice } = await import('obsidian');
    (Notice as any).resetInstances();

    const fakeThis: any = {
      settings: { languages: ['xx-not-a-real-language'] },
      contextAnalyzer: null,
    };
    NaturalLanguageDates.prototype.resetParser.call(fakeThis);

    expect(fakeThis.parser).toBeDefined();
    expect((Notice as any).instances.length).toBe(1);
    expect((Notice as any).instances[0].message).toContain('Using English as fallback');
  });

  it('shows a critical-error Notice when both the configured languages and the English fallback fail', async () => {
    vi.doMock('../src/parser', () => ({
      default: vi.fn().mockImplementation(() => {
        throw new Error('boom: nothing works');
      }),
    }));

    const { default: NaturalLanguageDates } = await import('../src/main');
    const { Notice } = await import('obsidian');
    (Notice as any).resetInstances();

    const fakeThis: any = {
      settings: { languages: ['xx-not-a-real-language'] },
      contextAnalyzer: null,
    };
    NaturalLanguageDates.prototype.resetParser.call(fakeThis);

    expect((Notice as any).instances.length).toBe(1);
    expect((Notice as any).instances[0].message).toContain('Critical error');
  });

  it('resets context patterns when a contextAnalyzer is present', async () => {
    const { default: NaturalLanguageDates } = await import('../src/main');
    const resetPatterns = vi.fn();
    const fakeThis: any = {
      settings: { languages: ['en'] },
      contextAnalyzer: { resetPatterns },
    };
    NaturalLanguageDates.prototype.resetParser.call(fakeThis);
    expect(resetPatterns).toHaveBeenCalled();
  });
});
