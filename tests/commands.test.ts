// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getParseCommand, getNowCommand, getCurrentDateCommand, getCurrentTimeCommand } from '../src/commands';
import NaturalLanguageDates from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';
import NLDParser from '../src/parser';
import moment from 'moment';

describe('Commands Integration Tests', () => {
  let plugin: NaturalLanguageDates;
  let mockEditor: any;
  let mockView: any;
  let mockApp: any;

  beforeEach(() => {
    // Setup window.moment
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    // Mock editor
    mockEditor = {
      getCursor: vi.fn(() => ({ line: 0, ch: 0 })),
      getSelection: vi.fn(() => ''),
      replaceSelection: vi.fn(),
      setCursor: vi.fn(),
      setSelection: vi.fn(),
      focus: vi.fn(),
      somethingSelected: vi.fn(() => true),
    };

    // Mock view
    mockView = {
      editor: mockEditor,
    };

    // Mock app
    mockApp = {
      workspace: {
        getActiveViewOfType: vi.fn(() => mockView),
        getLeavesOfType: vi.fn(() => []),
        getMostRecentLeaf: vi.fn(() => null),
      },
    };

    // Create plugin instance
    plugin = {
      app: mockApp,
      settings: { ...DEFAULT_SETTINGS },
      parser: null as any,
      parseDate: vi.fn((text: string) => {
        const parsed = moment(text || 'today');
        return {
          formattedString: parsed.format('YYYY-MM-DD'),
          date: parsed.toDate(),
          moment: parsed,
        };
      }),
      parseDateRange: vi.fn(() => null),
      parseTime: vi.fn((text: string) => {
        const parsed = moment(text || 'now');
        return {
          formattedString: parsed.format('HH:mm'),
          date: parsed.toDate(),
          moment: parsed,
        };
      }),
      hasTimeComponent: vi.fn((text: string) => text.includes('at') || text.includes('now')),
    } as any;

    // Initialize parser
    plugin.parser = new NLDParser(['en', 'fr']);
  });

  describe('getParseCommand', () => {
    it('should replace selected text with date link in replace mode', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow');
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02',
        date: moment('2024-01-02').toDate(),
        moment: moment('2024-01-02'),
      }));

      getParseCommand(plugin, 'replace');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('[[2024-01-02]]');
      expect(mockEditor.focus).toHaveBeenCalled();
    });

    it('positions the cursor at the end of the auto-expanded word, not the pre-expansion cursor position', () => {
      // Cursor placed mid-word ("tom|orrow", ch=3) with nothing selected --
      // getSelectedText() expands the selection to the full word (ch 0-8)
      // before replaceSelection() runs. The cursor used for adjustCursor()'s
      // offset math must reflect that expanded selection's end, not the
      // original mid-word position.
      let selectionEnd = { line: 0, ch: 3 };
      mockEditor.somethingSelected = vi.fn(() => false);
      mockEditor.posToOffset = vi.fn((pos: any) => pos.ch);
      mockEditor.offsetToPos = vi.fn((offset: number) => ({ line: 0, ch: offset }));
      mockEditor.cm = { state: { wordAt: vi.fn(() => ({ from: 0, to: 8 })) } };
      mockEditor.setSelection = vi.fn((_from: any, to: any) => { selectionEnd = to; });
      mockEditor.getSelection = vi.fn(() => 'tomorrow');
      mockEditor.getCursor = vi.fn((which?: string) => (which === 'to' ? selectionEnd : { line: 0, ch: 3 }));
      plugin.hasTimeComponent = vi.fn(() => false);
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02',
        date: moment('2024-01-02').toDate(),
        moment: moment('2024-01-02'),
      }));

      getParseCommand(plugin, 'replace');

      // newStr "[[2024-01-02]]" (14 chars) - oldStr "tomorrow" (8 chars) = +6 offset,
      // applied to the expanded word's end (ch 8), not the original ch 3.
      expect(mockEditor.setCursor).toHaveBeenCalledWith({ line: 0, ch: 14 });
    });

    it('should create markdown link in link mode', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow');
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02',
        date: moment('2024-01-02').toDate(),
        moment: moment('2024-01-02'),
      }));

      getParseCommand(plugin, 'link');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('[tomorrow](2024-01-02)');
    });

    it('should insert plain text in clean mode', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow');
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02',
        date: moment('2024-01-02').toDate(),
        moment: moment('2024-01-02'),
      }));

      getParseCommand(plugin, 'clean');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('2024-01-02');
    });

    it('should handle date with time component in replace mode', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow at 3pm');
      plugin.hasTimeComponent.mockReturnValue(true);
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02 15:00',
        date: moment('2024-01-02 15:00').toDate(),
        moment: moment('2024-01-02 15:00'),
      }));
      plugin.settings.format = 'YYYY-MM-DD';
      plugin.settings.timeFormat = 'HH:mm';

      getParseCommand(plugin, 'replace');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('[[2024-01-02]] 15:00');
    });

    it('should handle date range', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 To 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [
          moment('2024-01-01'),
          moment('2024-01-02'),
          moment('2024-01-03'),
          moment('2024-01-04'),
          moment('2024-01-05'),
        ],
      }));

      getParseCommand(plugin, 'replace');

      expect(mockEditor.replaceSelection).toHaveBeenCalled();
      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toContain('2024-01-01');
      expect(callArgs).toContain('2024-01-05');
    });

    it('should do nothing if no active view', () => {
      mockApp.workspace.getActiveViewOfType.mockReturnValue(null);

      getParseCommand(plugin, 'replace');

      expect(mockEditor.replaceSelection).not.toHaveBeenCalled();
    });

    it('should handle invalid date gracefully', () => {
      mockEditor.getSelection.mockReturnValue('invalid date');
      plugin.parseDate = vi.fn(() => ({
        formattedString: 'Invalid date',
        date: new Date('invalid'),
        moment: moment.invalid(),
      }));

      getParseCommand(plugin, 'replace');

      expect(mockEditor.setCursor).toHaveBeenCalled();
      expect(mockEditor.replaceSelection).not.toHaveBeenCalled();
    });

    it('should insert a Markdown link for each date in a range, in link mode', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-02',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-02').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-02'),
        isRange: true,
        dateList: [moment('2024-01-01'), moment('2024-01-02')],
      }));

      getParseCommand(plugin, 'link');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('[2024-01-01](2024-01-01), [2024-01-02](2024-01-02)');
    });

    it('should insert plain formatted dates for each date in a range, in clean/other modes', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-02',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-02').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-02'),
        isRange: true,
        dateList: [moment('2024-01-01'), moment('2024-01-02')],
      }));

      getParseCommand(plugin, 'clean');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('2024-01-01, 2024-01-02');
    });

    it('should fall back to the start-to-end range format when dateList is empty, in replace mode', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 To 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));

      getParseCommand(plugin, 'replace');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('[[2024-01-01]] To [[2024-01-05]]');
    });

    it('should fall back to a Markdown link for the whole range when dateList is empty, in link mode', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 To 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: undefined,
      }));

      getParseCommand(plugin, 'link');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('[from Monday to Friday](2024-01-01 To 2024-01-05)');
    });

    it('should fall back to plain "start to end" text when dateList is empty, in clean mode', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 To 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));

      getParseCommand(plugin, 'clean');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('2024-01-01 To 2024-01-05');
    });

    it('should fall back to plain "start to end" text when dateList is empty, in time mode', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 To 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));

      getParseCommand(plugin, 'time');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('2024-01-01 To 2024-01-05');
    });

    it('should omit the date and insert just the time for a short relative expression today', () => {
      mockEditor.getSelection.mockReturnValue('in 15 min');
      plugin.settings.omitDateForShortRelative = true;
      plugin.settings.timeFormat = 'HH:mm';
      plugin.hasTimeComponent = vi.fn(() => true);
      const today = moment().add(15, 'minutes');
      plugin.parseDate = vi.fn(() => ({
        formattedString: today.format('YYYY-MM-DD'),
        date: today.toDate(),
        moment: today,
      }));

      getParseCommand(plugin, 'replace');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe(today.format('HH:mm'));
    });

    it('should default to English "to" when no languages are configured', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.settings.languages = [];
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));

      getParseCommand(plugin, 'clean');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe('2024-01-01 To 2024-01-05');
    });

    it('should insert nothing for an unrecognized mode on a range', () => {
      mockEditor.getSelection.mockReturnValue('from Monday to Friday');
      plugin.parseDateRange = vi.fn(() => ({
        formattedString: '2024-01-01 to 2024-01-05',
        startDate: moment('2024-01-01').toDate(),
        endDate: moment('2024-01-05').toDate(),
        startMoment: moment('2024-01-01'),
        endMoment: moment('2024-01-05'),
        isRange: true,
        dateList: [],
      }));

      getParseCommand(plugin, 'not-a-real-mode');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('');
    });

    it('should insert nothing for an unrecognized mode on a non-range date', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow');
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02',
        date: moment('2024-01-02').toDate(),
        moment: moment('2024-01-02'),
      }));

      getParseCommand(plugin, 'not-a-real-mode');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('');
    });

    it('should default the time part to HH:mm when no timeFormat is configured (omitted-date case)', () => {
      mockEditor.getSelection.mockReturnValue('in 15 min');
      plugin.settings.omitDateForShortRelative = true;
      plugin.settings.timeFormat = '';
      plugin.hasTimeComponent = vi.fn(() => true);
      const today = moment().add(15, 'minutes');
      plugin.parseDate = vi.fn(() => ({
        formattedString: today.format('YYYY-MM-DD'),
        date: today.toDate(),
        moment: today,
      }));

      getParseCommand(plugin, 'replace');

      const callArgs = mockEditor.replaceSelection.mock.calls[0][0];
      expect(callArgs).toBe(today.format('HH:mm'));
    });

    it('should default the time part to HH:mm when no timeFormat is configured (hybrid date+time case)', () => {
      mockEditor.getSelection.mockReturnValue('tomorrow at 3pm');
      plugin.hasTimeComponent.mockReturnValue(true);
      plugin.settings.timeFormat = '';
      plugin.settings.format = 'YYYY-MM-DD';
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-02 15:00',
        date: moment('2024-01-02 15:00').toDate(),
        moment: moment('2024-01-02 15:00'),
      }));

      getParseCommand(plugin, 'replace');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('[[2024-01-02]] 15:00');
    });

    it('should insert just the time in time mode for a non-range date', () => {
      mockEditor.getSelection.mockReturnValue('now');
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2024-01-01',
        date: moment('2024-01-01 14:30').toDate(),
        moment: moment('2024-01-01 14:30'),
      }));
      plugin.parseTime = vi.fn(() => ({
        formattedString: '14:30',
        date: moment('2024-01-01 14:30').toDate(),
        moment: moment('2024-01-01 14:30'),
      }));

      getParseCommand(plugin, 'time');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('14:30');
    });
  });

  describe('getNowCommand', () => {
    it('should insert current date and time', () => {
      getNowCommand(plugin);

      expect(mockEditor.replaceSelection).toHaveBeenCalled();
      const insertedText = mockEditor.replaceSelection.mock.calls[0][0];
      expect(insertedText).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
    });

    it('should do nothing if no active editor is available', () => {
      mockApp.workspace.getActiveViewOfType.mockReturnValue(null);

      expect(() => getNowCommand(plugin)).not.toThrow();
      expect(mockEditor.replaceSelection).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentDateCommand', () => {
    it('should insert current date only', () => {
      getCurrentDateCommand(plugin);

      expect(mockEditor.replaceSelection).toHaveBeenCalled();
      const insertedText = mockEditor.replaceSelection.mock.calls[0][0];
      expect(insertedText).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  describe('getCurrentTimeCommand', () => {
    it('should insert current time only', () => {
      getCurrentTimeCommand(plugin);

      expect(mockEditor.replaceSelection).toHaveBeenCalled();
      const insertedText = mockEditor.replaceSelection.mock.calls[0][0];
      expect(insertedText).toMatch(/\d{2}:\d{2}/);
    });
  });
});

