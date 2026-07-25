// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach } from 'vitest';
import NaturalLanguageDates from '../src/main';
import NLDParser from '../src/parser';
import { DEFAULT_SETTINGS } from '../src/settings';
import moment from 'moment';

// parseDate() is invoked against a real prototype-linked instance (not a
// mock) so we exercise the actual NLDParser.getParsedPeriod() integration,
// following the same "Object.create(prototype)" pattern used by
// main-reset-parser.test.ts to avoid mocking the entire Obsidian Plugin
// lifecycle for a method that only touches this.settings/this.parser.
describe('NaturalLanguageDates.parseDate: periodic-note granularity formats (weekFormat/monthFormat/quarterFormat/yearFormat)', () => {
  let plugin: NaturalLanguageDates;

  beforeEach(() => {
    plugin = Object.create(NaturalLanguageDates.prototype);
    (plugin as any).settings = { ...DEFAULT_SETTINGS };
    (plugin as any).parser = new NLDParser(['en']);
  });

  describe('Default behavior (all granularity formats empty) is unchanged', () => {
    it('formats a plain day expression with the daily format', () => {
      const result = plugin.parseDate('tomorrow');
      expect(result.formattedString).toBe(moment().add(1, 'day').format('YYYY-MM-DD'));
    });

    it('formats "next month" with the daily format when monthFormat is not configured', () => {
      const result = plugin.parseDate('next month');
      const expected = moment().add(1, 'months').startOf('month').format('YYYY-MM-DD');
      expect(result.formattedString).toBe(expected);
    });

    it('formats "next week" with the daily format when weekFormat is not configured (single-date path)', () => {
      const result = plugin.parseDate('next week');
      // Day-granularity fallback path (this.parse -> getParsedDate), same as
      // before this feature existed -- just needs to be a valid date next week.
      expect(result.moment.isValid()).toBe(true);
      expect(result.moment.isAfter(moment(), 'day')).toBe(true);
    });
  });

  describe('When a granularity format is configured', () => {
    it('uses weekFormat for "next week"', () => {
      plugin.settings.weekFormat = 'GGGG-[W]WW';
      const result = plugin.parseDate('next week');
      const expected = moment().add(1, 'week').format('GGGG-[W]WW');
      expect(result.formattedString).toBe(expected);
    });

    it('uses monthFormat for "next month"', () => {
      plugin.settings.monthFormat = 'YYYY-MM';
      const result = plugin.parseDate('next month');
      const expected = moment().add(1, 'months').format('YYYY-MM');
      expect(result.formattedString).toBe(expected);
    });

    it('uses quarterFormat for "next quarter"', () => {
      plugin.settings.quarterFormat = 'YYYY-[Q]Q';
      const result = plugin.parseDate('next quarter');
      const expected = moment().add(1, 'quarter').format('YYYY-[Q]Q');
      expect(result.formattedString).toBe(expected);
    });

    it('uses quarterFormat for the explicit "Q3" form', () => {
      plugin.settings.quarterFormat = 'YYYY-[Q]Q';
      const result = plugin.parseDate('Q3');
      const expected = moment().quarter(3).format('YYYY-[Q]Q');
      expect(result.formattedString).toBe(expected);
    });

    it('uses yearFormat for "next year"', () => {
      plugin.settings.yearFormat = 'YYYY';
      const result = plugin.parseDate('next year');
      const expected = moment().add(1, 'years').format('YYYY');
      expect(result.formattedString).toBe(expected);
    });

    it('does not use monthFormat for a plain day expression, even when configured', () => {
      plugin.settings.monthFormat = 'YYYY-MM';
      const result = plugin.parseDate('tomorrow');
      expect(result.formattedString).toBe(moment().add(1, 'day').format('YYYY-MM-DD'));
    });

    it('falls back to the daily format when the configured quarterFormat is invalid', () => {
      plugin.settings.quarterFormat = '<script>alert(1)</script>';
      const result = plugin.parseDate('next quarter');
      const expected = moment().add(1, 'quarter').startOf('quarter').format(DEFAULT_SETTINGS.format);
      expect(result.formattedString).toBe(expected);
    });
  });

  describe('Regression: this feature must not resurrect a time-of-day on period results', () => {
    it('"next month" formatted with a format that includes time tokens still only shows the period, since periods carry no time', () => {
      plugin.settings.monthFormat = 'YYYY-MM-DD HH:mm';
      const result = plugin.parseDate('next month');
      // startOf('month') zeroes the time -- verifies getParsedPeriod's date
      // (not some other now()-based value) is what actually gets formatted.
      expect(result.formattedString.endsWith('00:00')).toBe(true);
    });
  });
});
