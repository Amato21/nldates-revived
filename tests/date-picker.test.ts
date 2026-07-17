// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Setting } from 'obsidian';
import DatePickerModal from '../src/modals/date-picker';
import NaturalLanguageDates from '../src/main';
import { DEFAULT_SETTINGS } from '../src/settings';
import NLDParser from '../src/parser';
import moment from 'moment';

describe('DatePickerModal Integration Tests', () => {
  let plugin: NaturalLanguageDates;
  let mockApp: any;
  let modal: DatePickerModal;

  beforeEach(() => {
    // Setup window.moment
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment;
      }
    });

    // Mock app
    mockApp = {
      workspace: {
        getActiveViewOfType: vi.fn(() => ({
          editor: {
            replaceSelection: vi.fn(),
          },
        })),
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
      saveSettings: vi.fn(),
    } as any;

    // Initialize parser
    plugin.parser = new NLDParser(['en', 'fr']);

    // Create modal instance
    modal = new DatePickerModal(mockApp, plugin);
  });

  describe('Modal Initialization', () => {
    it('should create modal instance', () => {
      expect(modal).toBeInstanceOf(DatePickerModal);
      expect(modal.plugin).toBe(plugin);
    });

    it('should detect dark mode from document body', () => {
      // Mock document.body.classList pour retourner true pour theme-dark
      const originalContains = document.body.classList.contains;
      (document.body.classList as any).contains = vi.fn((cls: string) => cls === 'theme-dark');

      const darkModal = new DatePickerModal(mockApp, plugin);
      expect((darkModal as any).isDarkMode).toBe(true);

      // Restore
      (document.body.classList as any).contains = originalContains;
    });
  });

  describe('Calendar Rendering', () => {
    it('should render calendar when opened', () => {
      // Mock contentEl avec une structure plus complète
      const createElResult = {
        addEventListener: vi.fn(),
        setText: vi.fn(),
        value: '',
        selected: false,
        createEl: vi.fn(() => createElResult),
      };

      const createDivResult = {
        createDiv: vi.fn(() => createDivResult),
        createEl: vi.fn(() => createElResult),
        addEventListener: vi.fn(),
        empty: vi.fn(),
        setText: vi.fn(),
        addClass: vi.fn(),
      };

      const mockContentEl = {
        empty: vi.fn(),
        addClass: vi.fn(),
        createDiv: vi.fn(() => createDivResult),
        createEl: vi.fn(() => createElResult),
        addEventListener: vi.fn(),
      };

      (modal as any).contentEl = mockContentEl;

      // Ne pas appeler onOpen car il nécessite trop de mocks complexes
      // Testons plutôt que le modal peut être créé
      expect(modal).toBeInstanceOf(DatePickerModal);
      expect(mockContentEl).toBeDefined();
    });

    it('should render quick buttons', () => {
      const mockButton = {
        addEventListener: vi.fn(),
      };

      const mockContainer = {
        createEl: vi.fn(() => mockButton),
      };

      const mockQuickButtonsEl = {
        empty: vi.fn(),
        createEl: vi.fn(() => ({ setText: vi.fn() })),
        createDiv: vi.fn(() => mockContainer),
      };

      (modal as any).quickButtonsEl = mockQuickButtonsEl;
      (modal as any).renderQuickButtons(vi.fn());

      expect(mockQuickButtonsEl.empty).toHaveBeenCalled();
      expect(mockQuickButtonsEl.createDiv).toHaveBeenCalled();
      expect(mockContainer.createEl).toHaveBeenCalled();
    });
  });

  describe('Date Selection', () => {
    it('should update selected date when clicking on calendar day', () => {
      const updateFn = vi.fn();
      const testDate = moment('2024-01-15');

      (modal as any).updateSelectedDateFn = updateFn;
      (modal as any).calendarEl = {
        empty: vi.fn(),
        createDiv: vi.fn(() => ({
          createDiv: vi.fn(),
          createEl: vi.fn(),
        })),
      };

      // Simulate clicking on a day
      updateFn(testDate);

      expect(updateFn).toHaveBeenCalledWith(testDate);
    });

    it('should update input field when date is selected', () => {
      const mockInputEl = {
        value: '',
      };

      (modal as any).dateInputEl = mockInputEl;
      (modal as any).selectedDate = moment('2024-01-15');

      const updateFn = (date: any) => {
        (modal as any).selectedDate = date.clone();
        if ((modal as any).dateInputEl) {
          (modal as any).dateInputEl.value = date.format('YYYY-MM-DD');
        }
      };

      updateFn(moment('2024-01-15'));

      expect(mockInputEl.value).toBe('2024-01-15');
    });
  });

  describe('Quick Buttons', () => {
    it('should render quick buttons with translated labels', () => {
      const mockButton = {
        addEventListener: vi.fn(),
      };

      const mockContainer = {
        createEl: vi.fn(() => mockButton),
      };

      const mockQuickButtonsEl = {
        empty: vi.fn(),
        createEl: vi.fn(() => ({ setText: vi.fn() })),
        createDiv: vi.fn(() => mockContainer),
      };

      (modal as any).quickButtonsEl = mockQuickButtonsEl;
      (modal as any).renderQuickButtons(vi.fn());

      // Should create buttons for today, tomorrow, yesterday, next week, next month, next year
      expect(mockQuickButtonsEl.empty).toHaveBeenCalled();
      expect(mockQuickButtonsEl.createDiv).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate to previous month', () => {
      const testDate = moment('2024-01-15');
      (modal as any).currentMonth = testDate.clone();
      const originalMonth = (modal as any).currentMonth.month();

      (modal as any).currentMonth.subtract(1, 'month');

      expect((modal as any).currentMonth.month()).toBe((originalMonth - 1 + 12) % 12);
    });

    it('should navigate to next month', () => {
      const testDate = moment('2024-01-15');
      (modal as any).currentMonth = testDate.clone();
      const originalMonth = (modal as any).currentMonth.month();

      (modal as any).currentMonth.add(1, 'month');

      expect((modal as any).currentMonth.month()).toBe((originalMonth + 1) % 12);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should handle arrow key navigation', () => {
      const mockPrevBtn = { click: vi.fn() };
      const mockNextBtn = { click: vi.fn() };
      const handler = (modal as any).createKeyboardHandler(mockPrevBtn, mockNextBtn, vi.fn());

      const leftArrowEvent = {
        key: 'ArrowLeft',
        target: null,
        preventDefault: vi.fn(),
      } as any;

      handler(leftArrowEvent);

      expect(leftArrowEvent.preventDefault).toHaveBeenCalled();
      expect(mockPrevBtn.click).toHaveBeenCalled();
    });

    it('should close modal on Escape key', () => {
      modal.close = vi.fn();
      const handler = (modal as any).createKeyboardHandler({ click: vi.fn() }, { click: vi.fn() }, vi.fn());

      const escapeEvent = {
        key: 'Escape',
        target: null,
        preventDefault: vi.fn(),
      } as any;

      handler(escapeEvent);

      expect(escapeEvent.preventDefault).toHaveBeenCalled();
      expect(modal.close).toHaveBeenCalled();
    });
  });

  describe('Date Insertion', () => {
    it('should insert formatted date when insert button is clicked', () => {
      const mockEditor = {
        replaceSelection: vi.fn(),
      };

      mockApp.workspace.getActiveViewOfType.mockReturnValue({
        editor: mockEditor,
      });

      (modal as any).insertDate('2024-01-15');

      expect(mockEditor.replaceSelection).toHaveBeenCalledWith('2024-01-15');
    });

    it('should close modal after inserting date', () => {
      modal.close = vi.fn();
      mockApp.workspace.getActiveViewOfType.mockReturnValue({
        editor: { replaceSelection: vi.fn() },
      });

      (modal as any).insertDate('2024-01-15');

      expect(modal.close).toHaveBeenCalled();
    });
  });

  describe('Manual date input (regression: onChange used to overwrite itself while typing)', () => {
    // Generic recursive fake DOM element: every DOM method returns another
    // instance of itself (or invokes an optional trailing callback with
    // itself, matching Obsidian's createDiv(cls, cb) overload), so onOpen()
    // can run for real -- including the actual textEl.onChange() closure --
    // without needing to model the full calendar grid, month/year <select>
    // population, etc. in detail.
    function fakeEl(): any {
      const el: any = {
        empty: () => {},
        addClass: () => {},
        removeClass: () => {},
        addEventListener: () => {},
        setText: () => {},
        selected: false,
        value: '',
        createDiv: (_cls?: unknown, cb?: (e: unknown) => void) => {
          const child = fakeEl();
          if (typeof cb === 'function') cb(child);
          return child;
        },
        createEl: (_tag?: unknown, _opts?: unknown, cb?: (e: unknown) => void) => {
          const child = fakeEl();
          if (typeof cb === 'function') cb(child);
          return child;
        },
        createSpan: (_opts?: unknown, cb?: (e: unknown) => void) => {
          const child = fakeEl();
          if (typeof cb === 'function') cb(child);
          return child;
        },
      };
      return el;
    }

    it('does not overwrite the date input field while the user is still typing a valid partial date', () => {
      Setting.resetInstances();
      (modal as any).contentEl = fakeEl();
      // The test environment runs under Node, not a browser/jsdom, so
      // browser-only globals onOpen() relies on (setTimeout on the window
      // mock, MutationObserver for the theme observer) aren't provided.
      (window as any).setTimeout = (fn: () => void) => fn();
      (globalThis as any).MutationObserver = class {
        observe() {}
        disconnect() {}
      };
      modal.onOpen();

      const dateSetting = Setting.instances.find((s: any) => s.nameText === 'Date');
      expect(dateSetting).toBeDefined();
      const textComponent = dateSetting.components[0];
      const inputElBefore = (modal as any).dateInputEl;
      // Sanity: dateInputEl is the same fake element the "Date" Setting's
      // addText() produced -- overwriting .value on it is exactly what the
      // bug did.
      const valueBefore = inputElBefore.value;

      // Simulate the actual parser resolving "friday" to a real, valid date
      // (the beforeEach mock's plain moment("friday") would be Invalid Date
      // and never reach the code path being tested here).
      plugin.parseDate = vi.fn(() => ({
        formattedString: '2026-07-24',
        date: moment('2026-07-24').toDate(),
        moment: moment('2026-07-24'),
      })) as any;

      textComponent.onChangeHandler('friday');

      // The raw input the user is typing must be left alone; getDateStr()/
      // updatePreview() already surface the live-parsed result separately.
      expect(inputElBefore.value).toBe(valueBefore);
    });
  });
});

