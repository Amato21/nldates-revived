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
        activeLeaf: null,
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
        formattedString: '2024-01-01 to 2024-01-05',
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
  });

  describe('getNowCommand', () => {
    it('should insert current date and time', () => {
      getNowCommand(plugin);

      expect(mockEditor.replaceSelection).toHaveBeenCalled();
      const insertedText = mockEditor.replaceSelection.mock.calls[0][0];
      expect(insertedText).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);
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

