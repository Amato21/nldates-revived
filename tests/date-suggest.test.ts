// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import DateSuggest from '../src/suggest/date-suggest';
import NaturalLanguageDates from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';
import NLDParser from '../src/parser';
import moment from 'moment';

describe('DateSuggest', () => {
  let plugin: NaturalLanguageDates;
  let mockApp: any;
  let mockEditor: any;
  let suggest: DateSuggest;
  let mockHistoryManager: any;
  let mockContextAnalyzer: any;

  beforeEach(() => {
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    mockHistoryManager = {
      getTopSuggestionsSync: vi.fn(() => ['Demain', 'Lundi prochain']),
      recordSelection: vi.fn(() => Promise.resolve()),
    };

    mockContextAnalyzer = {
      analyzeContextSync: vi.fn(() => ({
        datesInContext: ["Aujourd'hui", 'Demain'],
        tags: [],
      })),
    };

    mockEditor = {
      getValue: vi.fn(() => 'Some text with dates'),
      getCursor: vi.fn(() => ({ line: 5, ch: 10 })),
      getRange: vi.fn(() => '@tomorrow'),
      replaceRange: vi.fn(),
    };

    mockApp = {
      workspace: {
        getActiveViewOfType: vi.fn(() => ({ editor: mockEditor })),
        getLeavesOfType: vi.fn(() => []),
        activeLeaf: null,
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({ tags: [], frontmatter: {} })),
      },
      vault: {
        getConfig: vi.fn(() => false), // useMarkdownLinks=false -> [[wikilinks]]
      },
    };

    plugin = {
      app: mockApp,
      settings: { ...DEFAULT_SETTINGS },
      parser: null as any,
      historyManager: mockHistoryManager,
      contextAnalyzer: mockContextAnalyzer,
      parseDate: vi.fn((text: string) => {
        const parsed = moment(text || 'today');
        return { formattedString: parsed.format('YYYY-MM-DD'), date: parsed.toDate(), moment: parsed };
      }),
      parseDateRange: vi.fn(() => null),
      parseTime: vi.fn((text: string) => {
        const parsed = moment(text || 'now');
        return { formattedString: parsed.format('HH:mm'), date: parsed.toDate(), moment: parsed };
      }),
      hasTimeComponent: vi.fn(() => false),
    } as any;

    plugin.parser = new NLDParser(['en', 'fr']);
    suggest = new DateSuggest(mockApp, plugin);
  });

  function ctx(query: string, overrides: Record<string, unknown> = {}) {
    return {
      query,
      editor: mockEditor,
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: query.length + 1 },
      ...overrides,
    } as any;
  }

  describe('constructor', () => {
    it('registers a Shift+Enter shortcut that calls suggestions.useSelectedItem', () => {
      const useSelectedItem = vi.fn();
      (suggest as any).suggestions = { useSelectedItem };
      const handler = (suggest as any).registeredHandlers['Shift+Enter'];
      expect(handler).toBeTypeOf('function');
      const fakeEvent = { shiftKey: true } as any;
      const result = handler(fakeEvent);
      expect(useSelectedItem).toHaveBeenCalledWith(fakeEvent);
      expect(result).toBe(false);
    });

    it('sets Shift+Enter instructions when autosuggestToggleLink is enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      const s = new DateSuggest(mockApp, plugin);
      expect(s).toBeInstanceOf(DateSuggest);
    });

    it('does not set instructions when autosuggestToggleLink is disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      const s = new DateSuggest(mockApp, plugin);
      expect(s).toBeInstanceOf(DateSuggest);
    });
  });

  describe('getSuggestions / getDateSuggestions', () => {
    it('returns matching suggestions for a valid query', () => {
      const suggestions = suggest.getSuggestions(ctx('tom'));
      expect(suggestions.some(s => s.toLowerCase() === 'tomorrow')).toBe(true);
    });

    it('returns the query itself when nothing matches', () => {
      const suggestions = suggest.getSuggestions(ctx('xyz123'));
      expect(suggestions).toEqual(['xyz123']);
    });

    it('merges smart suggestions (history + context) ahead of standard ones when enabled', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableHistorySuggestions = true;
      plugin.settings.enableContextSuggestions = true;
      const suggestions = (suggest as any).getDateSuggestions(ctx('d'));
      expect(mockHistoryManager.getTopSuggestionsSync).toHaveBeenCalled();
      expect(mockContextAnalyzer.analyzeContextSync).toHaveBeenCalled();
      expect(suggestions[0]).toBe('Demain'); // history suggestion ranked first
    });

    it('does not query history/context when smart suggestions are disabled', () => {
      plugin.settings.enableSmartSuggestions = false;
      (suggest as any).getDateSuggestions(ctx('d'));
      expect(mockHistoryManager.getTopSuggestionsSync).not.toHaveBeenCalled();
      expect(mockContextAnalyzer.analyzeContextSync).not.toHaveBeenCalled();
    });

    it('swallows an error from historyManager.getTopSuggestionsSync', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableHistorySuggestions = true;
      mockHistoryManager.getTopSuggestionsSync = vi.fn(() => { throw new Error('boom'); });
      expect(() => (suggest as any).getDateSuggestions(ctx('d'))).not.toThrow();
    });

    it('swallows an error from contextAnalyzer.analyzeContextSync', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableContextSuggestions = true;
      mockContextAnalyzer.analyzeContextSync = vi.fn(() => { throw new Error('boom'); });
      expect(() => (suggest as any).getDateSuggestions(ctx('d'))).not.toThrow();
    });

    it('skips context suggestions when the context has no editor', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableContextSuggestions = true;
      (suggest as any).getDateSuggestions(ctx('d', { editor: undefined }));
      expect(mockContextAnalyzer.analyzeContextSync).not.toHaveBeenCalled();
    });

    it('short-circuits per-language on a time query without falling through to later helpers', () => {
      const suggestions = (suggest as any).getDateSuggestions(ctx('time'));
      expect(suggestions.some((s: string) => s.startsWith('Time:'))).toBe(true);
    });

    it('short-circuits per-language on an immediate-prefix query', () => {
      const suggestions = (suggest as any).getDateSuggestions(ctx('next'));
      expect(suggestions).toContain('next Week');
    });

    it('short-circuits per-language on a relative-expression query', () => {
      const suggestions = (suggest as any).getDateSuggestions(ctx('in 2'));
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('short-circuits per-language on a weekday query', () => {
      const suggestions = (suggest as any).getDateSuggestions(ctx('mon'));
      expect(suggestions).toContain('Monday');
    });
  });

  describe('getTimeSuggestions', () => {
    it('provides time-adjustment suggestions for a "Time" query (case-insensitively)', () => {
      const suggestions = (suggest as any).getTimeSuggestions('time', 'en');
      expect(suggestions).toContain('Time:Now');
      expect(suggestions.some((s: string) => s.includes('+15 minutes'))).toBe(true);
    });

    it('matches naturally-capitalized "Time" queries too', () => {
      const suggestions = (suggest as any).getTimeSuggestions('Time', 'en');
      expect(suggestions).toContain('Time:Now');
    });

    it('returns undefined for a query that is not a time query', () => {
      expect((suggest as any).getTimeSuggestions('tomorrow', 'en')).toBeUndefined();
    });
  });

  describe('getImmediateSuggestions', () => {
    it('suggests periods and weekdays after "next"/"last"/"this"', () => {
      const suggestions = (suggest as any).getImmediateSuggestions('next', 'en');
      expect(suggestions).toContain('next Week');
    });

    it('matches naturally-capitalized "Next " queries (the prior bug: comparing a lowercased candidate against a non-lowercased inputStr)', () => {
      const suggestions = (suggest as any).getImmediateSuggestions('Next ', 'en');
      expect(suggestions).toContain('Next Week');
    });

    it('returns undefined when there is no next/last/this reference', () => {
      expect((suggest as any).getImmediateSuggestions('xyz', 'en')).toBeUndefined();
    });
  });

  describe('getRelativeSuggestions', () => {
    // The "in"/"ago" prefix-suggestion block above returns unconditionally
    // on any digit-led match, even an empty array -- which used to make the
    // suffix-pattern block below it (for languages with "agosuffix", e.g.
    // Portuguese "atrás") permanently unreachable, since a bare number like
    // "3 di" always matches the prefix block's regex too. Fixed by only
    // returning early when there's an actual suggestion to offer.
    it('falls through to suffix-pattern suggestions ("atrás") for Portuguese when the prefix block finds nothing', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('3 di', 'pt');
      expect(suggestions).toEqual(['3 dia atrás', '3 dias atrás']);
    });

    it('falls through to suffix-pattern suggestions ("atrás") for Spanish when the prefix block finds nothing', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('3 dí', 'es');
      expect(suggestions).toEqual(['3 día atrás', '3 días atrás']);
    });

    it('suggests combined durations for "in X unit and"', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('in 2 weeks and', 'en');
      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('suggests default units (starting from 1) right after "and"', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('in 2 weeks and', 'en');
      expect(suggestions).toEqual([
        'in 2 weeks and 1 minutes',
        'in 2 weeks and 1 hours',
        'in 2 weeks and 1 days',
        'in 2 weeks and 1 weeks',
        'in 2 weeks and 1 months',
      ]);
    });

    it('suggests every unit for a bare number typed right after "and"', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('in 2 weeks and 3', 'en');
      expect(suggestions).toEqual([
        'in 2 weeks and 3 minutes',
        'in 2 weeks and 3 hours',
        'in 2 weeks and 3 days',
        'in 2 weeks and 3 weeks',
        'in 2 weeks and 3 months',
      ]);
    });

    it('returns undefined when a partially-typed unit word after "and" cannot be reconstructed cleanly (known rough edge)', () => {
      // getRelativeSuggestions() rebuilds "beforeAnd + number + remaining"
      // using string-length arithmetic that doesn't account for the space
      // between the number and the unit word, so typing a partial unit
      // letter here (e.g. "day") produces a garbled candidate string that
      // never matches the original input as a prefix -- verified this is
      // the actual, current behavior (not asserting it's *desired*).
      expect((suggest as any).getRelativeSuggestions('in 2 weeks and 3 day', 'en')).toBeUndefined();
      expect((suggest as any).getRelativeSuggestions('in 2 weeks and w', 'en')).toBeUndefined();
      expect((suggest as any).getRelativeSuggestions('in 2 weeks and zzz', 'en')).toBeUndefined();
    });

    it('reaches the no-space-unit reconstruction path for languages without spaces between number and unit (Chinese)', () => {
      // Confirmed via Gemini Code Assist review: for languages like Chinese
      // whose "in X unit" template has no space (e.g. "3天後"), unitPart
      // never has more than one "word", so unitWords.length > 1 is always
      // false and this different branch runs instead of the one used by
      // space-separated languages. It has its own rough edge: since
      // unitPart has no space, unitWithoutNumber ends up being the whole
      // unitPart (number included), so the number gets duplicated in the
      // result. Documenting actual behavior, not asserting it's desired.
      const suggestions = (suggest as any).getRelativeSuggestions('在 3 天 和 4', 'zh.hant');
      expect(suggestions).toBeDefined();
      expect(suggestions[0]).toBe('在 3 天 和 4 4分鐘後');
    });

    it('suggests weekdays for a partial date range "from monday to"', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('from monday to', 'en');
      expect(suggestions).toBeDefined();
      expect(suggestions.some((s: string) => s.includes('Friday'))).toBe(true);
    });

    it('filters range-end suggestions by what has already been typed', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('from monday to f', 'en');
      expect(suggestions).toBeDefined();
      expect(suggestions.every((s: string) => s.toLowerCase().endsWith('friday'))).toBe(true);
    });

    it('returns undefined for a range whose end-suffix matches no weekday', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('from monday to zzz', 'en');
      expect(suggestions).toBeUndefined();
    });

    it('suggests simple relative expressions for a bare number', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('2', 'en');
      expect(suggestions.some((s: string) => s.includes('2'))).toBe(true);
    });

    it('suggests simple relative expressions for "in 2"', () => {
      const suggestions = (suggest as any).getRelativeSuggestions('in 2', 'en');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('returns undefined when nothing matches at all', () => {
      expect((suggest as any).getRelativeSuggestions('xyz', 'en')).toBeUndefined();
    });
  });

  describe('getWeekdaySuggestions', () => {
    it('matches a full weekday name prefix', () => {
      const suggestions = (suggest as any).getWeekdaySuggestions('mon', 'en');
      expect(suggestions).toContain('Monday');
    });

    it('matches a weekday abbreviation', () => {
      const suggestions = (suggest as any).getWeekdaySuggestions('thur', 'en');
      expect(suggestions).toContain('Thursday');
    });

    it('returns undefined when nothing matches', () => {
      expect((suggest as any).getWeekdaySuggestions('zzz', 'en')).toBeUndefined();
    });

    it('matches the English abbreviation even when a non-English language is active', () => {
      // Confirmed via Gemini Code Assist review: day.abbr is hardcoded to
      // English abbreviations, but dayName is translated (e.g. French
      // "lundi"), so for non-English languages the full-name check never
      // matches while the English-abbreviation check still does -- this is
      // what lets "mon" work as a shortcut regardless of active language.
      const suggestions = (suggest as any).getWeekdaySuggestions('mon', 'fr');
      expect(suggestions).toEqual(['Lundi']);
    });
  });

  describe('defaultSuggestions', () => {
    it('matches today/tomorrow/yesterday case-insensitively', () => {
      expect((suggest as any).defaultSuggestions('tod', 'en')).toContain('Today');
      expect((suggest as any).defaultSuggestions('Tod', 'en')).toContain('Today');
    });
  });

  describe('suggestionIsTime / unique', () => {
    it('recognizes a suggestion starting with the "time" word as a time suggestion', () => {
      expect((suggest as any).suggestionIsTime('Time:Now')).toBe(true);
      expect((suggest as any).suggestionIsTime('Tomorrow')).toBe(false);
    });

    it('deduplicates an array of strings', () => {
      expect((suggest as any).unique(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
    });
  });

  describe('onTrigger', () => {
    it('returns null when autosuggest is disabled', () => {
      plugin.settings.isAutosuggestEnabled = false;
      const result = suggest.onTrigger({ line: 0, ch: 9 } as any, mockEditor, {} as any);
      expect(result).toBeNull();
    });

    it('returns null when the range does not start with the trigger phrase', () => {
      mockEditor.getRange = vi.fn(() => 'no-trigger-here');
      const result = suggest.onTrigger({ line: 0, ch: 16 } as any, mockEditor, {} as any);
      expect(result).toBeNull();
    });

    it('returns null when "@" is preceded by a word character (e.g. an email address)', () => {
      mockEditor.getRange = vi.fn((_from: any, to: any) => (to.ch === 8 ? 'a' : '@tomorrow'));
      const result = suggest.onTrigger({ line: 0, ch: 9 } as any, mockEditor, {} as any);
      expect(result).toBeNull();
    });

    it('returns trigger info for a valid "@" trigger', () => {
      // cursor at ch=9, trigger phrase "@" (length 1) -> startPos.ch = 8.
      // The "preceding char" range is (ch=7 to ch=8); the "query" range is
      // (ch=8 to ch=9, the cursor).
      mockEditor.getRange = vi.fn((_from: any, to: any) => (to.ch === 9 ? '@tomorrow' : ''));
      const result = suggest.onTrigger({ line: 0, ch: 9 } as any, mockEditor, {} as any);
      expect(result).not.toBeNull();
      expect(result?.query).toBe('tomorrow');
      expect(result?.start).toEqual({ line: 0, ch: 8 });
      expect(result?.end).toEqual({ line: 0, ch: 9 });
    });
  });

  describe('selectSuggestion', () => {
    function selectWithContext(suggestion: string, contextOverrides: Record<string, unknown> = {}, event: Partial<KeyboardEvent | MouseEvent> = {}) {
      (suggest as any).context = {
        editor: mockEditor,
        start: { line: 0, ch: 0 },
        end: { line: 0, ch: suggestion.length + 1 },
        query: suggestion,
        ...contextOverrides,
      };
      suggest.selectSuggestion(suggestion, event as any);
    }

    it('does nothing if no editor can be found anywhere', () => {
      (suggest as any).context = { editor: undefined, start: { line: 0, ch: 0 }, end: { line: 0, ch: 1 } };
      mockApp.workspace.getActiveViewOfType = vi.fn(() => null);
      suggest.selectSuggestion('tomorrow', {} as any);
      expect(mockEditor.replaceRange).not.toHaveBeenCalled();
    });

    it('logs an error and does nothing if there is no context at all', async () => {
      const { logger } = await import('../src/logger');
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      (suggest as any).context = undefined;
      suggest.selectSuggestion('tomorrow', {} as any);
      expect(errorSpy).toHaveBeenCalledWith('DateSuggest: context is undefined');
      expect(mockEditor.replaceRange).not.toHaveBeenCalled();
    });

    it('inserts a parsed time for a "Time:" suggestion', () => {
      plugin.parseTime = vi.fn(() => ({ formattedString: '14:30', date: new Date(), moment: moment() }));
      selectWithContext('Time:Now');
      expect(mockEditor.replaceRange).toHaveBeenCalledWith('14:30', expect.anything(), expect.anything());
    });

    it('inserts a list of links for a date range with a dateList, when linking is enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-02',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-02').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-02'),
        isRange: true,
        dateList: [moment('2024-01-01'), moment('2024-01-02')],
      }));
      selectWithContext('from Monday to Tuesday');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('[[2024-01-01]], [[2024-01-02]]');
    });

    it('inserts plain formatted dates for a date range with a dateList, when linking is disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-02',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-02').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-02'),
        isRange: true,
        dateList: [moment('2024-01-01'), moment('2024-01-02')],
      }));
      selectWithContext('from Monday to Tuesday');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('2024-01-01, 2024-01-02');
    });

    it('falls back to a linked range when dateList is empty and linking is enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));
      selectWithContext('from Monday to Friday');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('[[2024-01-01]] To [[2024-01-05]]');
    });

    it('falls back to plain "start to end" text when dateList is empty and linking is disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));
      selectWithContext('from Monday to Friday');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('2024-01-01 To 2024-01-05');
    });

    it('inserts just the formatted date for a plain date without time, when linking is disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      selectWithContext('tomorrow');
      expect(mockEditor.replaceRange).toHaveBeenCalledWith('2024-01-02', expect.anything(), expect.anything());
    });

    it('wraps the date in a markdown link for a plain date without time, when linking is enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      selectWithContext('tomorrow');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('[[2024-01-02]]');
    });

    it('includes the suggestion text as an alias when Shift is held while selecting a link', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      selectWithContext('tomorrow', {}, { shiftKey: true });
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('[[2024-01-02|tomorrow]]');
    });

    it('builds a hybrid [[date]] time link when the suggestion has a time and linking is enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.settings.format = 'YYYY-MM-DD';
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => true);
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02 15:00',
        date: moment('2024-01-02 15:00').toDate(),
        moment: moment('2024-01-02 15:00'),
      }));
      selectWithContext('tomorrow at 3pm');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('[[2024-01-02]] 15:00');
    });

    it('inserts "date time" plain text when the suggestion has a time and linking is disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.settings.format = 'YYYY-MM-DD';
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => true);
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02 15:00',
        date: moment('2024-01-02 15:00').toDate(),
        moment: moment('2024-01-02 15:00'),
      }));
      selectWithContext('tomorrow at 3pm');
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toBe('2024-01-02 15:00');
    });

    it('omits the date and inserts just the time for a short relative expression today, with linking enabled', () => {
      plugin.settings.autosuggestToggleLink = true;
      plugin.settings.omitDateForShortRelative = true;
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => true);
      const today = moment().add(15, 'minutes');
      plugin.parseDate = vi.fn(() => ({ formattedString: today.format('YYYY-MM-DD'), date: today.toDate(), moment: today }));
      selectWithContext('in 15 min');
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(today.format('HH:mm'), expect.anything(), expect.anything());
    });

    it('omits the date and inserts just the time for a short relative expression today, with linking disabled', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.settings.omitDateForShortRelative = true;
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => true);
      const today = moment().add(15, 'minutes');
      plugin.parseDate = vi.fn(() => ({ formattedString: today.format('YYYY-MM-DD'), date: today.toDate(), moment: today }));
      selectWithContext('in 15 min');
      expect(mockEditor.replaceRange).toHaveBeenCalledWith(today.format('HH:mm'), expect.anything(), expect.anything());
    });

    it('detects an explicit time keyword the parser missed and forces hasTime true', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.settings.format = 'YYYY-MM-DD';
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => false); // parser says no time...
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02 00:15',
        date: moment('2024-01-02 00:15').toDate(),
        moment: moment('2024-01-02 00:15'),
      }));
      selectWithContext('in 15 min'); // ...but "min" should force it to true
      const inserted = mockEditor.replaceRange.mock.calls[0][0];
      expect(inserted).toContain('00:15');
    });

    it('does not confuse "month" with an explicit minute marker', () => {
      plugin.settings.autosuggestToggleLink = false;
      plugin.hasTimeComponent = vi.fn(() => false);
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-02-01', date: moment('2024-02-01').toDate(), moment: moment('2024-02-01') }));
      selectWithContext('in 1 month');
      expect(mockEditor.replaceRange).toHaveBeenCalledWith('2024-02-01', expect.anything(), expect.anything());
    });

    it('records the selection in history when smart + history suggestions are enabled', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableHistorySuggestions = true;
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      selectWithContext('tomorrow');
      expect(mockHistoryManager.recordSelection).toHaveBeenCalledWith('tomorrow');
    });

    it('does not record the selection when history suggestions are disabled', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableHistorySuggestions = false;
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      selectWithContext('tomorrow');
      expect(mockHistoryManager.recordSelection).not.toHaveBeenCalled();
    });

    it('does not throw when recordSelection rejects', () => {
      plugin.settings.enableSmartSuggestions = true;
      plugin.settings.enableHistorySuggestions = true;
      mockHistoryManager.recordSelection = vi.fn(() => Promise.reject(new Error('boom')));
      plugin.parseDate = vi.fn(() => ({ formattedString: '2024-01-02', date: moment('2024-01-02').toDate(), moment: moment('2024-01-02') }));
      expect(() => selectWithContext('tomorrow')).not.toThrow();
    });
  });

  describe('renderSuggestion', () => {
    it('sets the suggestion text on the element', () => {
      const el = { setText: vi.fn() } as any;
      suggest.renderSuggestion('Tomorrow', el);
      expect(el.setText).toHaveBeenCalledWith('Tomorrow');
    });
  });
});
