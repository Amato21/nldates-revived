// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach } from 'vitest';
import DateSuggest from '../src/suggest/date-suggest';
import NaturalLanguageDates from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';
import NLDParser from '../src/parser';
import moment from 'moment';

// End-to-end check using the REAL NaturalLanguageDates.parseDate()/parseDateRange()
// and a REAL NLDParser (no mocked plugin.parseDate), unlike the mocked-plugin
// tests in date-suggest.test.ts. This is what actually proves the #59 fix
// works through the full autosuggest path, and empirically checks the
// "monthly notes don't link either" claim from
// https://github.com/Amato21/nldates-revived/issues/59#issuecomment-5939850442
// -- weekFormat is the only granularity that ever goes through
// parseDateRange()'s range-vs-period logic (the thing #59 was actually about),
// so month was never affected by that particular bug, but it's worth proving
// rather than assuming.
describe('Autosuggest end-to-end: periodic-note formats via the real plugin classes (#59)', () => {
  let plugin: NaturalLanguageDates;
  let mockApp: any;
  let mockEditor: any;
  let suggest: DateSuggest;

  beforeEach(() => {
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    mockEditor = {
      getCursor: () => ({ line: 0, ch: 0 }),
      replaceRange: (text: string) => { mockEditor.lastInserted = text; },
      lastInserted: undefined as string | undefined,
    };

    mockApp = {
      workspace: {
        getActiveViewOfType: () => ({ editor: mockEditor }),
      },
      vault: {
        getConfig: () => false, // useMarkdownLinks=false -> [[wikilinks]]
      },
    };

    plugin = Object.create(NaturalLanguageDates.prototype);
    (plugin as any).settings = { ...DEFAULT_SETTINGS, languages: ['en'] };
    (plugin as any).parser = new NLDParser(['en']);

    suggest = new DateSuggest(mockApp, plugin);
  });

  function select(suggestion: string) {
    (suggest as any).context = {
      editor: mockEditor,
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: suggestion.length + 1 },
      query: suggestion,
    };
    suggest.selectSuggestion(suggestion, {} as any);
    return mockEditor.lastInserted as string;
  }

  it("inserts the 7-day link list for 'next week' when weekFormat is not configured (default)", () => {
    const inserted = select('next week');
    expect(inserted).toMatch(/^\[\[\d{4}-\d{2}-\d{2}\]\](, \[\[\d{4}-\d{2}-\d{2}\]\]){6}$/);
  });

  it("inserts a single weekFormat link for 'next week' when weekFormat is configured", () => {
    plugin.settings.weekFormat = 'GGGG-[W]WW';
    const inserted = select('next week');
    const expected = `[[${moment().add(1, 'week').format('GGGG-[W]WW')}]]`;
    expect(inserted).toBe(expected);
  });

  it("inserts a single monthFormat link for 'next month' when monthFormat is configured", () => {
    plugin.settings.monthFormat = 'YYYY-MM';
    const inserted = select('next month');
    const expected = `[[${moment().add(1, 'month').format('YYYY-MM')}]]`;
    expect(inserted).toBe(expected);
  });

  it("'next month' already links correctly even without monthFormat configured (day-formatted, not broken)", () => {
    const inserted = select('next month');
    const expected = `[[${moment().add(1, 'month').startOf('month').format('YYYY-MM-DD')}]]`;
    expect(inserted).toBe(expected);
  });
});
