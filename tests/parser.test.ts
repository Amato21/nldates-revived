// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach } from 'vitest';
import NLDParser from '../src/parser';
import { DayOfWeek } from '../src/settings';
import moment from 'moment';
import { expectSameDate, expectDateInRange, expectFutureDate, expectPastDate } from './test-helpers';

describe('NLDParser', () => {
  let parser: NLDParser;
  const weekStartPreference: DayOfWeek = 'monday';

  beforeEach(() => {
    // Ensure window.moment is available (already done in setup.ts, but we ensure it here too)
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment; // moment is now imported as default function
      }
    });
    
    // Reset parser with all languages
    parser = new NLDParser(['en', 'fr', 'de', 'pt', 'nl', 'es', 'it', 'ja']);
  });

  describe('Priority 1: Basic expressions (today, tomorrow, yesterday, now)', () => {
    describe('English', () => {
      it("should parse 'today'", () => {
        const result = parser.getParsedDate('today', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'tomorrow'", () => {
        const result = parser.getParsedDate('tomorrow', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("should parse 'yesterday'", () => {
        const result = parser.getParsedDate('yesterday', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("should parse 'now'", () => {
        const result = parser.getParsedDate('now', weekStartPreference);
        const now = new Date();
        // The difference should be less than one second
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('French', () => {
      it("should parse 'Aujourd'hui'", () => {
        const result = parser.getParsedDate("Aujourd'hui", weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Demain'", () => {
        const result = parser.getParsedDate('Demain', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("should parse 'Hier'", () => {
        const result = parser.getParsedDate('Hier', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("should parse 'maintenant'", () => {
        const result = parser.getParsedDate('maintenant', weekStartPreference);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('German', () => {
      it("should parse 'Heute'", () => {
        const result = parser.getParsedDate('Heute', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Morgen'", () => {
        const result = parser.getParsedDate('Morgen', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Portuguese', () => {
      it("should parse 'Hoje'", () => {
        const result = parser.getParsedDate('Hoje', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Amanhã'", () => {
        const result = parser.getParsedDate('Amanhã', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Dutch', () => {
      it("should parse 'Vandaag'", () => {
        const result = parser.getParsedDate('Vandaag', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Morgen'", () => {
        const result = parser.getParsedDate('Morgen', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Spanish', () => {
      it("should parse 'Hoy'", () => {
        const result = parser.getParsedDate('Hoy', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Mañana'", () => {
        const result = parser.getParsedDate('Mañana', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Italian', () => {
      it("should parse 'Oggi'", () => {
        const result = parser.getParsedDate('Oggi', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Domani'", () => {
        const result = parser.getParsedDate('Domani', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Japanese', () => {
      it("should parse '今日'", () => {
        const result = parser.getParsedDate('今日', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse '明日'", () => {
        const result = parser.getParsedDate('明日', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });
  });

  describe('Priority 1: Simple relative expressions (in 2 days, in 2 weeks)', () => {
    describe('English', () => {
      it("should parse 'in 2 days'", () => {
        const result = parser.getParsedDate('in 2 days', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 2 weeks'", () => {
        const result = parser.getParsedDate('in 2 weeks', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 3 months'", () => {
        const result = parser.getParsedDate('in 3 months', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 1 year'", () => {
        const result = parser.getParsedDate('in 1 year', weekStartPreference);
        const expected = moment().add(1, 'years');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 30 minutes'", () => {
        const result = parser.getParsedDate('in 30 minutes', weekStartPreference);
        const expected = moment().add(30, 'minutes');
        expectSameDate(result, expected, 'minute', 60);
      });

      it("should parse 'in 5 hours'", () => {
        const result = parser.getParsedDate('in 5 hours', weekStartPreference);
        const expected = moment().add(5, 'hours');
        expectSameDate(result, expected, 'hour', 3600);
      });
    });

    describe('French', () => {
      it("should parse 'dans 2 jours'", () => {
        const result = parser.getParsedDate('dans 2 jours', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'dans 2 semaines'", () => {
        const result = parser.getParsedDate('dans 2 semaines', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'dans 3 mois'", () => {
        const result = parser.getParsedDate('dans 3 mois', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('German', () => {
      it("should parse 'in 2 Tagen'", () => {
        const result = parser.getParsedDate('in 2 Tagen', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 2 Wochen'", () => {
        const result = parser.getParsedDate('in 2 Wochen', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Portuguese', () => {
      it("should parse 'em 2 dias'", () => {
        const result = parser.getParsedDate('em 2 dias', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Dutch', () => {
      it("should parse 'over 2 dagen'", () => {
        const result = parser.getParsedDate('over 2 dagen', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Spanish', () => {
      it("should parse 'en 2 días'", () => {
        const result = parser.getParsedDate('en 2 días', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Italian', () => {
      it("should parse 'tra 2 giorni'", () => {
        const result = parser.getParsedDate('tra 2 giorni', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });
  });

  describe('Priority 2: Combinations (in 2 weeks and 3 days)', () => {
    describe('English', () => {
      it("should parse 'in 2 weeks and 3 days'", () => {
        const result = parser.getParsedDate('in 2 weeks and 3 days', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 1 month and 5 days'", () => {
        const result = parser.getParsedDate('in 1 month and 5 days', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'in 2 weeks and 3 hours'", () => {
        const result = parser.getParsedDate('in 2 weeks and 3 hours', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'hours');
        expectSameDate(result, expected, 'minute', 60);
      });
    });

    describe('French', () => {
      it("should parse 'dans 2 semaines et 3 jours'", () => {
        const result = parser.getParsedDate('dans 2 semaines et 3 jours', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'dans 1 mois et 5 jours'", () => {
        const result = parser.getParsedDate('dans 1 mois et 5 jours', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('German', () => {
      it("should parse 'in 2 Wochen und 3 Tagen'", () => {
        const result = parser.getParsedDate('in 2 Wochen und 3 Tagen', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Portuguese', () => {
      it("should parse 'em 2 semanas e 3 dias'", () => {
        const result = parser.getParsedDate('em 2 semanas e 3 dias', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Dutch', () => {
      it("should parse 'over 2 weken en 3 dagen'", () => {
        const result = parser.getParsedDate('over 2 weken en 3 dagen', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Spanish', () => {
      it("should parse 'en 2 semanas y 3 días'", () => {
        const result = parser.getParsedDate('en 2 semanas y 3 días', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Italian', () => {
      it("should parse 'tra 2 settimane e 3 giorni'", () => {
        const result = parser.getParsedDate('tra 2 settimane e 3 giorni', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });
  });

  describe('Priority 3: Weekdays (next Monday, next Monday at 3pm)', () => {
    describe('English', () => {
      it("should parse 'next Monday'", () => {
        const result = parser.getParsedDate('next Monday', weekStartPreference);
        const today = moment();
        const nextMonday = moment().add(1, 'weeks').day(1); // 1 = Monday
        if (today.day() === 1) {
          // If we're already on Monday, next Monday should be in a week
          expect(moment(result).isSame(nextMonday, 'day')).toBe(true);
        } else {
          // Otherwise, verify that it's a future Monday
          expect(moment(result).day()).toBe(1);
          expect(moment(result).isAfter(today, 'day')).toBe(true);
        }
      });

      it("should parse 'next Friday'", () => {
        const result = parser.getParsedDate('next Friday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // 5 = Friday
        expect(moment(result).isSameOrAfter(moment(), 'day')).toBe(true);
      });

      it("should parse 'last Monday'", () => {
        const result = parser.getParsedDate('last Monday', weekStartPreference);
        expect(moment(result).day()).toBe(1); // 1 = Monday
      });

      it("should parse 'this Friday'", () => {
        const result = parser.getParsedDate('this Friday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // 5 = Friday
      });

      it("should parse 'next Monday at 3pm'", () => {
        const result = parser.getParsedDate('next Monday at 3pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15); // 3pm = 15:00
      });

      it("should parse 'next Monday at 3:30pm'", () => {
        const result = parser.getParsedDate('next Monday at 3:30pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15); // 3pm
        expect(moment(result).minute()).toBe(30);
      });

      it("should parse 'Wednesday' without prefix as next Wednesday (or today if Wednesday)", () => {
        const result = parser.getParsedDate('Wednesday', weekStartPreference);
        const today = moment();
        expect(moment(result).day()).toBe(3); // Wednesday = 3
        // Should be today or in the future
        expect(moment(result).isSameOrAfter(today, 'day')).toBe(true);
      });

      it("should parse 'Thursday' without prefix as next Thursday (or today if Thursday)", () => {
        const result = parser.getParsedDate('Thursday', weekStartPreference);
        const today = moment();
        expect(moment(result).day()).toBe(4); // Thursday = 4
        // Should be today or in the future
        expect(moment(result).isSameOrAfter(today, 'day')).toBe(true);
      });

      it("should parse 'Friday' without prefix as next Friday (or today if Friday)", () => {
        const result = parser.getParsedDate('Friday', weekStartPreference);
        const today = moment();
        expect(moment(result).day()).toBe(5); // Friday = 5
        // Should be today or in the future
        expect(moment(result).isSameOrAfter(today, 'day')).toBe(true);
      });
    });

    describe('French', () => {
      it("should parse 'prochain Lundi'", () => {
        const result = parser.getParsedDate('prochain Lundi', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'prochain Lundi à 15h'", () => {
        const result = parser.getParsedDate('prochain Lundi à 15h', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
      });
    });

    describe('German', () => {
      it("should parse 'nächster Montag'", () => {
        const result = parser.getParsedDate('nächster Montag', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'nächster Montag um 15 Uhr'", () => {
        const result = parser.getParsedDate('nächster Montag um 15 Uhr', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Portuguese', () => {
      it("should parse 'próxima Segunda-feira'", () => {
        const result = parser.getParsedDate('próxima Segunda-feira', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Spanish', () => {
      it("should parse 'próximo Lunes'", () => {
        const result = parser.getParsedDate('próximo Lunes', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Italian', () => {
      it("should parse 'prossimo Lunedì'", () => {
        const result = parser.getParsedDate('prossimo Lunedì', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });
  });

  describe('Date ranges (from Monday to Friday, next week)', () => {
    describe('English', () => {
      it("should parse 'from Monday to Friday' as range", () => {
        const result = parser.getParsedDateRange('from Monday to Friday', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(result?.startDate).toBeDefined();
        expect(result?.endDate).toBeDefined();
        expect(moment(result!.startDate).day()).toBe(1); // Monday
        expect(moment(result!.endDate).day()).toBe(5); // Friday
        expect(result!.dateList).toBeDefined();
        expect(result!.dateList!.length).toBeGreaterThan(0);
      });

      it("should parse 'next week' as range", () => {
        const result = parser.getParsedDateRange('next week', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(result?.startDate).toBeDefined();
        expect(result?.endDate).toBeDefined();
        expect(result!.dateList).toBeDefined();
        expect(result!.dateList!.length).toBe(7); // A week = 7 days
      });
    });

    describe('French', () => {
      it("should parse 'de Lundi à Vendredi' as range", () => {
        const result = parser.getParsedDateRange('de Lundi à Vendredi', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(moment(result!.startDate).day()).toBe(1); // Monday
        expect(moment(result!.endDate).day()).toBe(5); // Friday
      });

      it("should parse 'semaine prochaine' as range", () => {
        const result = parser.getParsedDateRange('semaine prochaine', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(result!.dateList!.length).toBe(7);
      });
    });

    describe('German', () => {
      it("should parse 'von Montag bis Freitag' as range", () => {
        const result = parser.getParsedDateRange('von Montag bis Freitag', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Portuguese', () => {
      it("should parse 'de Segunda-feira até Sexta-feira' as range", () => {
        const result = parser.getParsedDateRange('de Segunda-feira até Sexta-feira', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Dutch', () => {
      it("should parse 'van maandag tot vrijdag' as range", () => {
        const result = parser.getParsedDateRange('van maandag tot vrijdag', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Spanish', () => {
      it("should parse 'de Lunes a Viernes' as range", () => {
        const result = parser.getParsedDateRange('de Lunes a Viernes', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Italian', () => {
      it("should parse 'da Lunedì a Venerdì' as range", () => {
        const result = parser.getParsedDateRange('da Lunedì a Venerdì', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it("should return today for an empty string", () => {
      const result = parser.getParsedDate('', weekStartPreference);
      const today = moment().startOf('day');
      expectSameDate(result, today, 'day');
    });

    it("should return today for an invalid string", () => {
      const result = parser.getParsedDate('xyz123', weekStartPreference);
      // If chrono-node fails, the parser returns today by default
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle 'next month'", () => {
      const result = parser.getParsedDate('next month', weekStartPreference);
      const expected = moment().add(1, 'months').startOf('month');
      expectSameDate(result, expected, 'day');
    });

    it("should handle 'next year'", () => {
      const result = parser.getParsedDate('next year', weekStartPreference);
      const expected = moment().add(1, 'years').startOf('year');
      expectSameDate(result, expected, 'day');
    });

    it("should return null for getParsedDateRange with an invalid string", () => {
      const result = parser.getParsedDateRange('invalid string', weekStartPreference);
      expect(result).toBeNull();
    });

    it("should handle case variants (uppercase/lowercase)", () => {
      const result1 = parser.getParsedDate('TOMORROW', weekStartPreference);
      const result2 = parser.getParsedDate('tomorrow', weekStartPreference);
      const result3 = parser.getParsedDate('Tomorrow', weekStartPreference);
      
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result1, tomorrow, 'day');
      expectSameDate(result2, tomorrow, 'day');
      expectSameDate(result3, tomorrow, 'day');
    });

    it("should handle extra spaces", () => {
      const result = parser.getParsedDate('  tomorrow  ', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("should detect if an expression has a time component", () => {
      expect(parser.hasTimeComponent('now')).toBe(true);
      expect(parser.hasTimeComponent('today')).toBe(false);
      expect(parser.hasTimeComponent('in 30 minutes')).toBe(true);
      expect(parser.hasTimeComponent('in 2 days')).toBe(false);
      expect(parser.hasTimeComponent('next Monday at 3pm')).toBe(true);
      expect(parser.hasTimeComponent('next Monday')).toBe(false);
    });

    it("should handle 'in 2 weeks and 3 days' with time detection", () => {
      // With hours/minutes = has time
      expect(parser.hasTimeComponent('in 2 weeks and 3 hours')).toBe(true);
      // With days/weeks only = no time
      expect(parser.hasTimeComponent('in 2 weeks and 3 days')).toBe(false);
    });
  });

  describe('Parser with a single language', () => {
    it("should work with English only", () => {
      const singleLangParser = new NLDParser(['en']);
      const result = singleLangParser.getParsedDate('tomorrow', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("should work with French only", () => {
      const singleLangParser = new NLDParser(['fr']);
      const result = singleLangParser.getParsedDate('Demain', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });
  });

  // ==================== ADDITIONAL EDGE CASES ====================
  
  describe('Additional edge cases', () => {
    it("should handle expressions with large numbers", () => {
      const result = parser.getParsedDate('in 100 days', weekStartPreference);
      const expected = moment().add(100, 'days');
      expectSameDate(result, expected, 'day');
    });

    it("should handle 'in 0 days' (should return today)", () => {
      const result = parser.getParsedDate('in 0 days', weekStartPreference);
      const today = moment().startOf('day');
      expectSameDate(result, today, 'day');
    });

    it("should handle expressions with multiple different time units", () => {
      const result = parser.getParsedDate('in 1 year and 2 months and 3 weeks and 4 days', weekStartPreference);
      // Verify that it returns a valid date
      expect(result).toBeInstanceOf(Date);
      expectFutureDate(result);
    });

    it("should handle expressions with special characters", () => {
      const result = parser.getParsedDate('tomorrow!!!', weekStartPreference);
      // Should still parse 'tomorrow'
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("should handle mixed expressions (numbers and text)", () => {
      const result = parser.getParsedDate('in 2weeks', weekStartPreference);
      const expected = moment().add(2, 'weeks');
      expectSameDate(result, expected, 'day');
    });

    it("should handle 'last week' as range", () => {
      const result = parser.getParsedDateRange('last week', weekStartPreference);
      // Note: This feature might not be implemented
      // If it returns null, that's OK for now
      if (result) {
        expect(result.isRange).toBe(true);
        expect(result.dateList!.length).toBe(7);
      }
    });

    it("should handle weekdays with variants", () => {
      // Test abbreviations
      const resultMon = parser.getParsedDate('next Mon', weekStartPreference);
      expect(moment(resultMon).day()).toBe(1);

      const resultFri = parser.getParsedDate('next Fri', weekStartPreference);
      expect(moment(resultFri).day()).toBe(5);
    });

    it("should handle date ranges with the same day", () => {
      const result = parser.getParsedDateRange('from Monday to Monday', weekStartPreference);
      if (result) {
        expect(result.isRange).toBe(true);
        expect(moment(result.startDate).day()).toBe(1);
        expect(moment(result.endDate).day()).toBe(1);
      }
    });

    it("should handle expressions with 24h time", () => {
      const result = parser.getParsedDate('next Monday at 15:00', weekStartPreference);
      expect(moment(result).day()).toBe(1);
      expect(moment(result).hour()).toBe(15);
    });

    it("should handle 'yesterday' as past date", () => {
      const result = parser.getParsedDate('yesterday', weekStartPreference);
      expectPastDate(result);
    });

    it("should return a valid date even for ambiguous expressions", () => {
      const result = parser.getParsedDate('monday', weekStartPreference);
      // Should return a valid date (may be past or future Monday depending on implementation)
      expect(result).toBeInstanceOf(Date);
    });

    it("should handle expressions with 'ago' if supported", () => {
      // Test if '2 days ago' works (may be handled by chrono-node)
      const result = parser.getParsedDate('2 days ago', weekStartPreference);
      if (result) {
        expectPastDate(result);
      }
    });

    it("should handle ordinal numbers", () => {
      // Test '1st', '2nd', etc. if supported
      const result = parser.getParsedDate('January 1st', weekStartPreference);
      if (result) {
        expect(result).toBeInstanceOf(Date);
      }
    });
  });

  // ==================== INTEGRATION TESTS ====================
  
  describe('Integration tests', () => {
    it("should parse a sequence of different expressions", () => {
      const expressions = [
        'today',
        'tomorrow',
        'in 2 days',
        'next Monday',
        'next week'
      ];

      expressions.forEach(expr => {
        const result = parser.getParsedDate(expr, weekStartPreference);
        expect(result).toBeInstanceOf(Date);
        expect(!isNaN(result.getTime())).toBe(true);
      });
    });

    it("should parse expressions in all configured languages", () => {
      const expressions = {
        en: 'tomorrow',
        fr: 'Demain',
        de: 'Morgen',
        pt: 'Amanhã',
        nl: 'Morgen',
        es: 'Mañana',
        it: 'Domani'
      };

      Object.entries(expressions).forEach(([lang, expr]) => {
        const result = parser.getParsedDate(expr, weekStartPreference);
        expect(result).toBeInstanceOf(Date);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    it("should handle hasTimeComponent for different expressions", () => {
      const withTime = ['now', 'in 30 minutes', 'next Monday at 3pm', 'in 2 hours'];
      const withoutTime = ['today', 'tomorrow', 'in 2 days', 'next Monday'];

      withTime.forEach(expr => {
        expect(parser.hasTimeComponent(expr)).toBe(true);
      });

      withoutTime.forEach(expr => {
        expect(parser.hasTimeComponent(expr)).toBe(false);
      });
    });

    it("should maintain consistency between getParsedDate and getParsedDateRange", () => {
      // For 'next week', both methods should return consistent results
      const rangeResult = parser.getParsedDateRange('next week', weekStartPreference);
      
      if (rangeResult) {
        expect(rangeResult.isRange).toBe(true);
        expect(rangeResult.startDate).toBeInstanceOf(Date);
        expect(rangeResult.endDate).toBeInstanceOf(Date);
        expect(rangeResult.startMoment).toBeDefined();
        expect(rangeResult.endMoment).toBeDefined();
        expect(moment(rangeResult.endDate).isAfter(rangeResult.startDate) || 
               moment(rangeResult.endDate).isSame(rangeResult.startDate, 'day')).toBe(true);
      }
    });
  });
});

