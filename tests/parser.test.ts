// IMPORTANT: This file MUST import setup.ts first to define window.moment
import './setup';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import NLDParser from '../src/parser';
import { DayOfWeek } from '../src/settings';
import moment from 'moment';
import { expectSameDate, expectFutureDate, expectPastDate } from './test-helpers';

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
    parser = new NLDParser(['en', 'fr', 'de', 'pt', 'nl', 'es', 'it', 'ja', 'ru', 'uk', 'zh.hant']);
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

      // "daqui a 3 dias" already worked; the bare "daqui 3 dias" (no "a"),
      // also common colloquial Portuguese, previously wasn't a registered
      // variant of the "in" key and silently fell through to "now".
      it("should parse the bare 'daqui' variant of 'in', without 'a'", () => {
        const result = parser.getParsedDate('daqui 3 dias', weekStartPreference);
        expectSameDate(result, moment().add(3, 'days'), 'day');
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

      // Japanese has no explicit "later" translation key, so its suffix
      // marker ("後") must be inferred from the "indays" template
      // (initializeRegex()'s fallback path for languages without "later").
      // That inference path had no test coverage before.
      it("should parse '2日後' (suffix marker inferred from the 'indays' template)", () => {
        const result = parser.getParsedDate('2日後', weekStartPreference);
        const expected = moment().add(2, 'days').startOf('day');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Russian', () => {
      it("should parse 'Сегодня'", () => {
        const result = parser.getParsedDate('Сегодня', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Завтра'", () => {
        const result = parser.getParsedDate('Завтра', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("should parse 'Вчера'", () => {
        const result = parser.getParsedDate('Вчера', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("should parse 'сейчас'", () => {
        const result = parser.getParsedDate('сейчас', weekStartPreference);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('Ukrainian', () => {
      it("should parse 'Сьогодні'", () => {
        const result = parser.getParsedDate('Сьогодні', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse 'Завтра'", () => {
        const result = parser.getParsedDate('Завтра', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("should parse 'Вчора'", () => {
        const result = parser.getParsedDate('Вчора', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("should parse 'зараз'", () => {
        const result = parser.getParsedDate('зараз', weekStartPreference);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('Chinese (Traditional)', () => {
      it("should parse '今天'", () => {
        const result = parser.getParsedDate('今天', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("should parse '明天'", () => {
        const result = parser.getParsedDate('明天', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("should parse '昨天'", () => {
        const result = parser.getParsedDate('昨天', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("should parse '現在'", () => {
        const result = parser.getParsedDate('現在', weekStartPreference);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
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

    describe('Russian', () => {
      it("should parse 'через 2 дня'", () => {
        const result = parser.getParsedDate('через 2 дня', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 2 недели'", () => {
        const result = parser.getParsedDate('через 2 недели', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 3 месяца'", () => {
        const result = parser.getParsedDate('через 3 месяца', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 30 минут'", () => {
        const result = parser.getParsedDate('через 30 минут', weekStartPreference);
        const expected = moment().add(30, 'minutes');
        expectSameDate(result, expected, 'minute', 60);
      });
    });

    describe('Ukrainian', () => {
      it("should parse 'через 2 дні'", () => {
        const result = parser.getParsedDate('через 2 дні', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 2 тижні'", () => {
        const result = parser.getParsedDate('через 2 тижні', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 3 місяці'", () => {
        const result = parser.getParsedDate('через 3 місяці', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Chinese (Traditional)', () => {
      it("should parse '2天後'", () => {
        const result = parser.getParsedDate('2天後', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse '2週後'", () => {
        const result = parser.getParsedDate('2週後', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("should parse '3個月後'", () => {
        const result = parser.getParsedDate('3個月後', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });

      it("should parse '30分鐘後'", () => {
        const result = parser.getParsedDate('30分鐘後', weekStartPreference);
        const expected = moment().add(30, 'minutes');
        expectSameDate(result, expected, 'minute', 60);
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

    describe('Russian', () => {
      it("should parse 'через 2 недели и 3 дня'", () => {
        const result = parser.getParsedDate('через 2 недели и 3 дня', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 1 месяц и 5 дней'", () => {
        const result = parser.getParsedDate('через 1 месяц и 5 дней', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Ukrainian', () => {
      it("should parse 'через 2 тижні і 3 дні'", () => {
        const result = parser.getParsedDate('через 2 тижні і 3 дні', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'через 1 місяць і 5 днів'", () => {
        const result = parser.getParsedDate('через 1 місяць і 5 днів', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Chinese (Traditional)', () => {
      it("should parse '2週和3天後'", () => {
        const result = parser.getParsedDate('2週和3天後', weekStartPreference);
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

      it("should parse 'last Monday' as Monday of the previous week", () => {
        const result = parser.getParsedDate('last Monday', weekStartPreference);
        expect(moment(result).day()).toBe(1); // 1 = Monday

        const expected = moment().day(1).subtract(1, 'week');
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'this Monday' as Monday of the current week (even if elapsed)", () => {
        const result = parser.getParsedDate('this Monday', weekStartPreference);
        expect(moment(result).day()).toBe(1); // 1 = Monday

        const expected = moment().day(1);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'this Friday'", () => {
        const result = parser.getParsedDate('this Friday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // 5 = Friday

        const expected = moment().day(5);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
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

      it("should parse 'last Monday at 3pm' (weekday-with-time, 'last' prefix)", () => {
        const result = parser.getParsedDate('last Monday at 3pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
        expect(moment(result).isBefore(moment(), 'day')).toBe(true);
      });

      // getParsedDateResult() used to always return a Date (never null), so
      // the "if time parsing fails, fall back to just the date" branch could
      // never actually run: chrono-node finding no match for the time part
      // silently produced `new Date()` (today, right now) instead, which was
      // then used as if it were the parsed time -- discarding the correctly
      // computed weekday entirely, not just the time-of-day.
      it("should fall back to the weekday date, not today, when the time part is unparseable", () => {
        const result = parser.getParsedDate('next Monday at zzqqxx', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).isAfter(moment(), 'day')).toBe(true); // next Monday, not today
      });

      it("should parse 'this Monday at 3pm' (weekday-with-time, 'this' prefix)", () => {
        const result = parser.getParsedDate('this Monday at 3pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
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

      it("should parse 'ce Lundi' as Monday of the current week (even if elapsed)", () => {
        const result = parser.getParsedDate('ce Lundi', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday = 1

        const expected = moment().day(1);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'ce Vendredi' as Friday of the current week (even if elapsed)", () => {
        const result = parser.getParsedDate('ce Vendredi', weekStartPreference);
        expect(moment(result).day()).toBe(5); // Friday = 5

        const expected = moment().day(5);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'prochain Lundi à 15h'", () => {
        const result = parser.getParsedDate('prochain Lundi à 15h', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
      });

      it("should parse 'dernier Lundi' as Monday of the previous week", () => {
        const result = parser.getParsedDate('dernier Lundi', weekStartPreference);
        const resultMoment = moment(result);
        
        expect(resultMoment.day()).toBe(1); // Must be a Monday

        const expected = moment().day(1).subtract(1, 'week');
        expect(resultMoment.isSame(expected, 'day')).toBe(true);
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

    describe('Russian', () => {
      it("should parse 'следующий Понедельник'", () => {
        const result = parser.getParsedDate('следующий Понедельник', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'этот Понедельник' as Monday of the current week", () => {
        const result = parser.getParsedDate('этот Понедельник', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        const expected = moment().day(1);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'последний Понедельник' as Monday of the previous week", () => {
        const result = parser.getParsedDate('последний Понедельник', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        const expected = moment().day(1).subtract(1, 'week');
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'следующий Понедельник в 15:00'", () => {
        const result = parser.getParsedDate('следующий Понедельник в 15:00', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
      });
    });

    describe('Ukrainian', () => {
      it("should parse 'наступний Понеділок'", () => {
        const result = parser.getParsedDate('наступний Понеділок', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'цей Понеділок' as Monday of the current week", () => {
        const result = parser.getParsedDate('цей Понеділок', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        const expected = moment().day(1);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });

      it("should parse 'останній Понеділок' as Monday of the previous week", () => {
        const result = parser.getParsedDate('останній Понеділок', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        const expected = moment().day(1).subtract(1, 'week');
        expect(moment(result).isSame(expected, 'day')).toBe(true);
      });
    });

    describe('Chinese (Traditional)', () => {
      it("should parse '下一個星期一'", () => {
        const result = parser.getParsedDate('下一個星期一', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse '這個星期一' as Monday of the current week", () => {
        const result = parser.getParsedDate('這個星期一', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        const expected = moment().day(1);
        expect(moment(result).isSame(expected, 'day')).toBe(true);
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

      it("should parse 'from Monday to Friday' via getParsedDate (returns the start date)", () => {
        const result = parser.getParsedDate('from Monday to Friday', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'from Saturday to Sunday' via getParsedDate (both days still ahead this week)", () => {
        const result = parser.getParsedDate('from Saturday to Sunday', weekStartPreference);
        expect(moment(result).day()).toBe(6); // Saturday
      });

      it("should parse 'from Friday to Monday' via getParsedDate (end day wraps to the following week)", () => {
        const result = parser.getParsedDate('from Friday to Monday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // Friday
      });

      it("should parse 'from Tuesday to Monday' via getParsedDateRange (end day earlier in the week wraps forward)", () => {
        const result = parser.getParsedDateRange('from Tuesday to Monday', weekStartPreference);
        expect(result).not.toBeNull();
        expect(moment(result!.startDate).day()).toBe(2); // Tuesday
        expect(moment(result!.endDate).day()).toBe(1); // Monday
        expect(moment(result!.endDate).isAfter(moment(result!.startDate))).toBe(true);
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

    describe('Russian', () => {
      it("should parse 'с Понедельника до Пятницы' as range", () => {
        const result = parser.getParsedDateRange('с Понедельника до Пятницы', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result) {
          expect(moment(result.startDate).day()).toBe(1); // Monday
          expect(moment(result.endDate).day()).toBe(5); // Friday
        }
      });

      it("should parse 'следующая неделя' as range", () => {
        const result = parser.getParsedDateRange('следующая неделя', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result && result.dateList) {
          expect(result.dateList.length).toBe(7);
        }
      });
    });

    describe('Ukrainian', () => {
      it("should parse 'з Понеділка до П'ятниці' as range", () => {
        const result = parser.getParsedDateRange('з Понеділка до П\'ятниці', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result) {
          expect(moment(result.startDate).day()).toBe(1); // Monday
          expect(moment(result.endDate).day()).toBe(5); // Friday
        }
      });

      it("should parse 'наступний тиждень' as range", () => {
        const result = parser.getParsedDateRange('наступний тиждень', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result && result.dateList) {
          expect(result.dateList.length).toBe(7);
        }
      });
    });

    describe('Chinese (Traditional)', () => {
      it("should parse '從星期一到星期五' as range", () => {
        const result = parser.getParsedDateRange('從星期一到星期五', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result) {
          expect(moment(result.startDate).day()).toBe(1); // Monday
          expect(moment(result.endDate).day()).toBe(5); // Friday
        }
      });

      it("should parse '下一個星期' as range", () => {
        const result = parser.getParsedDateRange('下一個星期', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        if (result && result.dateList) {
          expect(result.dateList.length).toBe(7);
        }
      });
    });
  });

  describe('Chinese: Simplified script and short forms', () => {
    // A native speaker pointed out that everyday Chinese input rarely matches
    // the formal Traditional forms used in the tests above: people write in
    // Simplified script (这/周/从/后 instead of 這/週/從/後), and use short
    // prefixes ("下星期一"/"下周一") far more often than the fully spelled-out
    // "下一個星期一". These tests lock in that both scripts and both the short
    // and formal prefix forms resolve to the same date.
    it("should parse simplified '这周一' and traditional '這周一' as the same date as '這個星期一'", () => {
      const formal = parser.getParsedDate('這個星期一', weekStartPreference);
      const simplified = parser.getParsedDate('这周一', weekStartPreference);
      const mixedScript = parser.getParsedDate('這周一', weekStartPreference);
      expectSameDate(simplified, moment(formal), 'day');
      expectSameDate(mixedScript, moment(formal), 'day');
    });

    it("should parse short prefix '下星期一' and '下周一' the same as '下一個星期一'", () => {
      const formal = parser.getParsedDate('下一個星期一', weekStartPreference);
      const shortTraditional = parser.getParsedDate('下星期一', weekStartPreference);
      const shortSimplified = parser.getParsedDate('下周一', weekStartPreference);
      expectSameDate(shortTraditional, moment(formal), 'day');
      expectSameDate(shortSimplified, moment(formal), 'day');
    });

    it("should parse '上週一' and '上周一' as last Monday", () => {
      const lastMonday = moment().day(1).subtract(1, 'week');
      expectSameDate(parser.getParsedDate('上週一', weekStartPreference), lastMonday, 'day');
      expectSameDate(parser.getParsedDate('上周一', weekStartPreference), lastMonday, 'day');
    });

    it("should parse a bare weekday '週一' / '周一' the same as '星期一'", () => {
      const formal = parser.getParsedDate('星期一', weekStartPreference);
      expectSameDate(parser.getParsedDate('週一', weekStartPreference), moment(formal), 'day');
      expectSameDate(parser.getParsedDate('周一', weekStartPreference), moment(formal), 'day');
    });

    it("should parse simplified relative expressions '2天后', '2周后', '3个月后', '30分钟后'", () => {
      expectSameDate(parser.getParsedDate('2天后', weekStartPreference), moment().add(2, 'days'), 'day');
      expectSameDate(parser.getParsedDate('2周后', weekStartPreference), moment().add(2, 'weeks'), 'day');
      expectSameDate(parser.getParsedDate('3个月后', weekStartPreference), moment().add(3, 'months'), 'day');
      expectSameDate(parser.getParsedDate('30分钟后', weekStartPreference), moment().add(30, 'minutes'), 'minute', 60);
    });

    it("should parse the '个星期' counter form '2个星期后' the same as '2週後'", () => {
      const traditional = parser.getParsedDate('2週後', weekStartPreference);
      const counterForm = parser.getParsedDate('2个星期后', weekStartPreference);
      expectSameDate(counterForm, moment(traditional), 'day');
    });

    it("should parse the colloquial '禮拜'/'礼拜' weekday form the same as '星期一'", () => {
      const formal = parser.getParsedDate('星期一', weekStartPreference);
      expectSameDate(parser.getParsedDate('禮拜一', weekStartPreference), moment(formal), 'day');
      expectSameDate(parser.getParsedDate('礼拜一', weekStartPreference), moment(formal), 'day');
      expectSameDate(parser.getParsedDate('下禮拜一', weekStartPreference), moment().add(1, 'week').day(1), 'day');
      expectSameDate(parser.getParsedDate('下礼拜一', weekStartPreference), moment().add(1, 'week').day(1), 'day');
    });

    it("should parse '之後/之后' and '以後/以后' as alternative suffix markers to '後/后'", () => {
      const twoDaysLater = parser.getParsedDate('2天後', weekStartPreference);
      const threeMonthsLater = parser.getParsedDate('3個月後', weekStartPreference);
      expectSameDate(parser.getParsedDate('2天之後', weekStartPreference), moment(twoDaysLater), 'day');
      expectSameDate(parser.getParsedDate('2天之后', weekStartPreference), moment(twoDaysLater), 'day');
      expectSameDate(parser.getParsedDate('3個月以後', weekStartPreference), moment(threeMonthsLater), 'day');
      expectSameDate(parser.getParsedDate('3个月以后', weekStartPreference), moment(threeMonthsLater), 'day');
    });

    it("should parse the colloquial '星期天' form the same as '星期日'", () => {
      const formal = parser.getParsedDate('星期日', weekStartPreference);
      expectSameDate(parser.getParsedDate('星期天', weekStartPreference), moment(formal), 'day');
    });

    it("should parse the '個禮拜'/'个礼拜' counter form the same as '2週後'", () => {
      const traditional = parser.getParsedDate('2週後', weekStartPreference);
      expectSameDate(parser.getParsedDate('2個禮拜後', weekStartPreference), moment(traditional), 'day');
      expectSameDate(parser.getParsedDate('2个礼拜后', weekStartPreference), moment(traditional), 'day');
    });

    it("should parse simplified '现在' as now", () => {
      const result = parser.getParsedDate('现在', weekStartPreference);
      expect(Math.abs(result.getTime() - Date.now())).toBeLessThan(1000);
    });

    it("should parse a simplified range '从周一到周五' as Monday to Friday", () => {
      const result = parser.getParsedDateRange('从周一到周五', weekStartPreference);
      expect(result).not.toBeNull();
      expect(result?.isRange).toBe(true);
      if (result) {
        expect(moment(result.startDate).day()).toBe(1); // Monday
        expect(moment(result.endDate).day()).toBe(5); // Friday
      }
    });
  });

  describe('Past expressions ("X ago") across languages', () => {
    // patternToRegex() (parser.ts) builds a regex from each language's
    // "daysago"/"hoursago"/etc. template. A bug there (escaping "%{timeDelta}"
    // after inserting its own "(\d+)" placeholder, and escaping "|" between
    // grammatical variants into a literal pipe) meant it silently never
    // matched anything, for any language. This wasn't caught before because
    // English "X days ago" is separately handled by a hardcoded fallback
    // regex, and chrono-node's own locale support quietly caught French/
    // German/Russian as a fallback -- except for Chinese, which has no
    // chrono-node support at all, so "3天前" ("3 days ago") silently resolved
    // to today instead of 3 days in the past. These tests exercise the
    // dedicated per-language pattern directly (not just cases a fallback
    // could paper over), including Russian's three grammatical forms
    // (день/дня/дней) which depend on the "|" alternation working correctly.
    it("should parse English 'ago' expressions", () => {
      const result = parser.getParsedDate('3 days ago', weekStartPreference);
      expectSameDate(result, moment().subtract(3, 'days'), 'day');
    });

    it("should parse French 'il y a' expressions", () => {
      const result = parser.getParsedDate('il y a 3 jours', weekStartPreference);
      expectSameDate(result, moment().subtract(3, 'days'), 'day');
    });

    it("should parse German 'vor' expressions", () => {
      const result = parser.getParsedDate('vor 2 Stunden', weekStartPreference);
      expectSameDate(result, moment().subtract(2, 'hours'), 'minute', 60);
    });

    it("should parse Russian 'назад' expressions across all three grammatical forms", () => {
      expectSameDate(parser.getParsedDate('1 день назад', weekStartPreference), moment().subtract(1, 'days'), 'day');
      expectSameDate(parser.getParsedDate('3 дня назад', weekStartPreference), moment().subtract(3, 'days'), 'day');
      expectSameDate(parser.getParsedDate('5 дней назад', weekStartPreference), moment().subtract(5, 'days'), 'day');
    });

    it("should parse Chinese '前' suffix expressions, which have no chrono-node fallback", () => {
      expectSameDate(parser.getParsedDate('3天前', weekStartPreference), moment().subtract(3, 'days'), 'day');
      expectSameDate(parser.getParsedDate('30分鐘前', weekStartPreference), moment().subtract(30, 'minutes'), 'minute', 2);
    });

    it("should parse Portuguese 'há' prefix expressions", () => {
      expectSameDate(parser.getParsedDate('há 3 dias', weekStartPreference), moment().subtract(3, 'days'), 'day');
    });

    // Portuguese also allows a suffix form ("3 dias atrás", literally "3 days
    // back") alongside the prefix form above ("há 3 dias") -- the past-tense
    // mirror of the "later"-suffix mechanism used for future expressions
    // (e.g. Chinese "2天後"). Before regexAgoSuffix/"agosuffix" existed, this
    // silently fell through every parsing level and resolved to "now"
    // instead of erroring or matching, the same "silent fallback" bug class
    // this file's other "ago" tests above were written to catch.
    it("should parse Portuguese 'atrás' suffix expressions", () => {
      expectSameDate(parser.getParsedDate('3 dias atrás', weekStartPreference), moment().subtract(3, 'days'), 'day');
      expectSameDate(parser.getParsedDate('5 dias atras', weekStartPreference), moment().subtract(5, 'days'), 'day');
    });

    // Spanish "atrás" has the same silent-fallback gap as Portuguese above --
    // the prefix form ("hace 3 días") already worked, the suffix form didn't.
    it("should parse Spanish 'atrás' suffix expressions", () => {
      expectSameDate(parser.getParsedDate('3 días atrás', weekStartPreference), moment().subtract(3, 'days'), 'day');
      expectSameDate(parser.getParsedDate('hace 3 días', weekStartPreference), moment().subtract(3, 'days'), 'day');
    });

    // The hardcoded English "ago" regex (/^(\d+)\s+(\w+)\s+ago$/i) accepts any
    // \w+ as a unit, unlike the translated-language paths whose regex only
    // ever captures words already registered in timeUnitMap -- so this one
    // has a genuinely reachable abbreviation-guessing fallback for units not
    // in any enabled language's dictionary (e.g. a typo, or a unit letter
    // English doesn't itself register).
    it("should guess the unit from its first letter(s) for unrecognized 'ago' units", () => {
      expectSameDate(parser.getParsedDate('2 hz ago', weekStartPreference), moment().subtract(2, 'hours'), 'minute');
      expectSameDate(parser.getParsedDate('2 dz ago', weekStartPreference), moment().subtract(2, 'days'), 'day');
      expectSameDate(parser.getParsedDate('2 jz ago', weekStartPreference), moment().subtract(2, 'days'), 'day');
      expectSameDate(parser.getParsedDate('2 wz ago', weekStartPreference), moment().subtract(2, 'weeks'), 'day');
      expectSameDate(parser.getParsedDate('2 sz ago', weekStartPreference), moment().subtract(2, 'weeks'), 'day');
      expectSameDate(parser.getParsedDate('2 moz ago', weekStartPreference), moment().subtract(2, 'months'), 'day');
      expectSameDate(parser.getParsedDate('2 yz ago', weekStartPreference), moment().subtract(2, 'years'), 'day');
      expectSameDate(parser.getParsedDate('2 az ago', weekStartPreference), moment().subtract(2, 'years'), 'day');
    });

    // The "in X unit and Y unit" multi-combination split (getParsedDate(),
    // ~line 563) also captures the unit generically ([^\s]+, not restricted
    // to known words), so it shares the same reachable fallback as above.
    it("should guess the unit from its first letter(s) in a multi-unit combination", () => {
      const result = parser.getParsedDate('in 2 hz and 3 dz', weekStartPreference);
      expectSameDate(result, moment().add(2, 'hours').add(3, 'days'), 'day');
      const result2 = parser.getParsedDate('in 2 wz and 3 sz', weekStartPreference);
      expectSameDate(result2, moment().add(2, 'weeks').add(3, 'weeks'), 'day');
      const result3 = parser.getParsedDate('in 2 moz and 3 yz', weekStartPreference);
      expectSameDate(result3, moment().add(2, 'months').add(3, 'years'), 'day');
      const result4 = parser.getParsedDate('in 2 az and 3 hz', weekStartPreference);
      expectSameDate(result4, moment().add(2, 'years').add(3, 'hours'), 'minute');
    });

    // "m" for minute is already registered by every Latin-script language we
    // support, so the ago-fallback's exact-match "unitStr === 'm'" branch can
    // only be reached with no such language enabled -- e.g. Japanese, whose
    // own minute translations are "分|ふん|ぷん|fun", not "m". The hardcoded
    // English ago-regex itself doesn't depend on which languages are enabled.
    it("should guess 'minutes' for a bare 'm' when no enabled language already registers it", () => {
      const jaOnlyParser = new NLDParser(['ja']);
      const result = jaOnlyParser.getParsedDate('2 m ago', weekStartPreference);
      expectSameDate(result, moment().subtract(2, 'minutes'), 'minute');
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

    // These specifically exercise the chrono-node fallback (Level 4) with only
    // English enabled. In the main describe block's 11-language parser, other
    // languages' chrono-node instances silently masked a real bug: chrono-node
    // 2.x removed createCasualConfiguration from its "en" locale module in
    // favor of pre-built casual/GB/strict Chrono instances, so getChronos()
    // could never actually build a working chrono for English -- every
    // expression not covered by the custom regex path (explicit times,
    // written-out dates like "March 15th") silently fell back to today/now
    // with no error, for any user who only enabled English.
    it("should apply the time component from chrono-node for 'next Monday at 3pm'", () => {
      const singleLangParser = new NLDParser(['en']);
      const result = singleLangParser.getParsedDate('next Monday at 3pm', weekStartPreference);
      expect(moment(result).hour()).toBe(15);
    });

    it("should parse an explicit written-out date via chrono-node, not silently return today", () => {
      const singleLangParser = new NLDParser(['en']);
      const result = singleLangParser.getParsedDate('March 15th 2027', weekStartPreference);
      expect(moment(result).month()).toBe(2); // March
      expect(moment(result).year()).toBe(2027);
    });

    // Regression: chrono-node can return several disjoint matches for one
    // string -- "today in 3 minutes" parses as two independent candidates,
    // ["today", "in 3 minutes"], neither containing the other.
    // getParsedDateResult() used to only ever look at the first candidate
    // chrono listed, silently discarding "in 3 minutes" and returning the
    // current time unmodified (reported by a user: combining a day keyword
    // with a relative time gave the right date but the wrong -- unmodified
    // -- time).
    it("should advance the time for a day keyword combined with a relative time expression, not just return now", () => {
      const singleLangParser = new NLDParser(['en']);
      const now = new Date();
      const result = singleLangParser.getParsedDate('today in 3 minutes', weekStartPreference);
      const diffMinutes = (result.getTime() - now.getTime()) / 60000;
      expect(diffMinutes).toBeGreaterThan(2);
      expect(diffMinutes).toBeLessThan(4);
    });

    it("should advance the time for a day keyword combined with a relative time expression in French", () => {
      const frenchParser = new NLDParser(['fr']);
      const now = new Date();
      const result = frenchParser.getParsedDate("aujourd'hui dans 3 minutes", weekStartPreference);
      const diffMinutes = (result.getTime() - now.getTime()) / 60000;
      expect(diffMinutes).toBeGreaterThan(2);
      expect(diffMinutes).toBeLessThan(4);
    });
  });

  describe('getParsedResult (raw chrono-node results, used by callers needing match metadata)', () => {
    it("should return chrono ParsedResult[] for a date chrono-node can parse", () => {
      const results = parser.getParsedResult('March 15th 2027');
      expect(results.length).toBeGreaterThan(0);
    });

    it("should return an empty array for empty input", () => {
      const results = parser.getParsedResult('');
      expect(results).toEqual([]);
    });

    it("should return null/[] respectively when chronos is empty or falsy", () => {
      const emptyChronosParser: any = new NLDParser(['en']);
      emptyChronosParser.chronos = [];
      expect(emptyChronosParser.getParsedDateResult('tomorrow')).toBeNull();

      const noChronosParser: any = new NLDParser(['en']);
      noChronosParser.chronos = null;
      expect(noChronosParser.getParsedResult('tomorrow')).toEqual([]);
    });

    it("should not throw and should skip a chrono instance whose parse() throws", () => {
      const throwingParser: any = new NLDParser(['en']);
      throwingParser.chronos[0].parse = () => { throw new Error('boom'); };
      expect(() => throwingParser.getParsedDateResult('tomorrow')).not.toThrow();
      expect(() => throwingParser.getParsedResult('tomorrow')).not.toThrow();
    });

    it("should not throw and should not log a spurious warning if a chrono instance's parse() returns null/undefined instead of an array", async () => {
      // chrono-node's own type signature guarantees ParsedResult[], but
      // that's not runtime-enforced -- guard against a misbehaving or
      // mocked instance returning a nullish value instead. The surrounding
      // try/catch already prevents a nullish result from throwing all the
      // way out to the caller (iterating `for...of null` would be caught
      // just like c.parse() itself throwing), but without a `|| []` guard
      // it would still log a spurious "Chrono parsing error" warning for
      // what is actually just "no matches", not a real error.
      const { logger } = await import('../src/logger');
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const nullishParser: any = new NLDParser(['en']);
      nullishParser.chronos[0].parse = () => null;

      expect(() => nullishParser.getParsedDateResult('tomorrow')).not.toThrow();
      expect(nullishParser.getParsedDateResult('tomorrow')).toBeNull();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCacheStats', () => {
    it("should report cache size growing after a parse and a positive maxSize", () => {
      const singleUseParser = new NLDParser(['en']);
      const before = singleUseParser.getCacheStats();
      singleUseParser.getParsedDate('tomorrow', weekStartPreference);
      const after = singleUseParser.getCacheStats();
      expect(after.size).toBeGreaterThan(before.size);
      expect(after.maxSize).toBeGreaterThan(0);
    });

    it("getDayOfWeekIndex should default to Sunday (0) for an unrecognized day name", () => {
      // White-box: this private method is only ever called internally with a
      // regex-validated weekday capture, so a truly unrecognized name can't
      // occur through the public API -- calling it directly locks in the
      // documented default-to-Sunday behavior for that defensive branch.
      const singleUseParser: any = new NLDParser(['en']);
      expect(singleUseParser.getDayOfWeekIndex('not-a-real-day')).toBe(0);
    });

    it("should fall back to today when chronos is empty (defensive, not reachable via real language configs)", () => {
      const singleUseParser: any = new NLDParser(['en']);
      singleUseParser.chronos = [];
      const result = singleUseParser.getParsedDate('totally unparseable garbage xyz', weekStartPreference);
      expect(moment(result).isSame(moment(), 'day')).toBe(true);
    });

    it("should clear the cache when the day changes", () => {
      // White-box: getParsedDate() invalidates its cache by comparing the
      // real day-of-year against the day it was last populated on. Forcing
      // a stale cacheDay is the only practical way to exercise that branch
      // without mocking the system clock.
      // Uses "next monday" rather than "today"/"now": those bypass the
      // cache entirely (see the "volatile expressions" tests below), so
      // they wouldn't touch cacheDay at all.
      const singleUseParser: any = new NLDParser(['en']);
      singleUseParser.getParsedDate('tomorrow', weekStartPreference);
      expect(singleUseParser.cache.size).toBeGreaterThan(0);
      singleUseParser.cacheDay = -999;
      singleUseParser.getParsedDate('next monday', weekStartPreference);
      expect(singleUseParser.cacheDay).not.toBe(-999);
    });
  });

  describe('Volatile expressions bypass the cache (issue #28)', () => {
    // "now"/"in X minutes"/"X ago" resolve relative to the exact current
    // instant. Regression test for the bug where they got cached for a
    // whole day, so repeated calls kept returning the first result they
    // ever produced that day instead of a fresh one.
    it("'now' should not be served from a stale cache entry", () => {
      const singleUseParser: any = new NLDParser(['en']);
      const first = singleUseParser.getParsedDate('now', weekStartPreference);
      // Poison the cache with a stale entry for the exact key 'now' would use,
      // so a cache hit would be detectable as wrong.
      const cacheKey = singleUseParser.generateCacheKey('now', weekStartPreference);
      singleUseParser.cache.set(cacheKey, new Date(0));
      const second = singleUseParser.getParsedDate('now', weekStartPreference);
      expect(second.getTime()).not.toBe(new Date(0).getTime());
      expect(moment(second).isSame(moment(), 'minute')).toBe(true);
      expect(first).toBeInstanceOf(Date);
    });

    it("'in 20 minutes' should not be served from a stale cache entry", () => {
      const singleUseParser: any = new NLDParser(['en']);
      singleUseParser.getParsedDate('in 20 minutes', weekStartPreference);
      const cacheKey = singleUseParser.generateCacheKey('in 20 minutes', weekStartPreference);
      singleUseParser.cache.set(cacheKey, new Date(0));
      const result = singleUseParser.getParsedDate('in 20 minutes', weekStartPreference);
      expect(result.getTime()).not.toBe(new Date(0).getTime());
      expect(moment(result).isSame(moment().add(20, 'minutes'), 'minute')).toBe(true);
    });

    it("'2 hours ago' should not be served from a stale cache entry", () => {
      const singleUseParser: any = new NLDParser(['en']);
      singleUseParser.getParsedDate('2 hours ago', weekStartPreference);
      const cacheKey = singleUseParser.generateCacheKey('2 hours ago', weekStartPreference);
      singleUseParser.cache.set(cacheKey, new Date(0));
      const result = singleUseParser.getParsedDate('2 hours ago', weekStartPreference);
      expect(result.getTime()).not.toBe(new Date(0).getTime());
      expect(moment(result).isSame(moment().subtract(2, 'hours'), 'minute')).toBe(true);
    });

    it("volatile expressions should never add entries to the cache", () => {
      const singleUseParser: any = new NLDParser(['en']);
      singleUseParser.getParsedDate('now', weekStartPreference);
      singleUseParser.getParsedDate('today', weekStartPreference);
      singleUseParser.getParsedDate('in 20 minutes', weekStartPreference);
      singleUseParser.getParsedDate('2 hours ago', weekStartPreference);
      expect(singleUseParser.cache.size).toBe(0);
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
        it: 'Domani',
        ru: 'Завтра',
        uk: 'Завтра',
        'zh.hant': '明天'
      };

      Object.entries(expressions).forEach(([, expr]) => {
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

  // ==================== COMPLEX DATE EXPRESSIONS ====================
  
  describe('Complex date expressions (the Xth of next month, last day of month, first/last weekday of month)', () => {
    describe('English', () => {
      it("should parse 'the 15th of next month'", () => {
        const result = parser.getParsedDate('the 15th of next month', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse '15th of next month' (without 'the')", () => {
        const result = parser.getParsedDate('15th of next month', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse 'the 1st of last month'", () => {
        const result = parser.getParsedDate('the 1st of last month', weekStartPreference);
        const expected = moment().subtract(1, 'months').startOf('month').date(1);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(1);
      });

      it("should parse 'the 15th of month' (bare, no prefix, defaults to this month)", () => {
        const result = parser.getParsedDate('the 15th of month', weekStartPreference);
        const expected = moment().startOf('month').date(15);
        expectSameDate(result, expected, 'day');
      });

      // regexOrdinalOfMonth also matches "year" words, not just months (the
      // "isYear" branch in getParsedDate() interprets the ordinal as a day of
      // year). This path had no test coverage at all before. Note the day
      // number is capped at 2 digits by ORDINAL_NUMBER_PATTERN (built for
      // days-of-month 1-31), so day-of-year values above 99 can't be reached
      // this way -- a real, separate limitation, not exercised here.
      it("should parse 'the 50th of next year' as day 50 of next year", () => {
        const result = parser.getParsedDate('the 50th of next year', weekStartPreference);
        expect(moment(result).year()).toBe(moment().add(1, 'years').year());
        expect(moment(result).dayOfYear()).toBe(50);
      });

      it("should parse 'the 50th of last year' as day 50 of last year", () => {
        const result = parser.getParsedDate('the 50th of last year', weekStartPreference);
        expect(moment(result).year()).toBe(moment().subtract(1, 'years').year());
        expect(moment(result).dayOfYear()).toBe(50);
      });

      it("should parse 'the 50th of this year' as day 50 of this year", () => {
        const result = parser.getParsedDate('the 50th of this year', weekStartPreference);
        expect(moment(result).year()).toBe(moment().year());
        expect(moment(result).dayOfYear()).toBe(50);
      });

      it("should parse 'the 50th of year' (bare, no prefix, defaults to this year)", () => {
        const result = parser.getParsedDate('the 50th of year', weekStartPreference);
        expect(moment(result).year()).toBe(moment().year());
        expect(moment(result).dayOfYear()).toBe(50);
      });

      it("should parse 'last day of month' (current month)", () => {
        const result = parser.getParsedDate('last day of month', weekStartPreference);
        const expected = moment().endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'last day of next month'", () => {
        const result = parser.getParsedDate('last day of next month', weekStartPreference);
        const expected = moment().add(1, 'months').endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'last day of last month'", () => {
        const result = parser.getParsedDate('last day of last month', weekStartPreference);
        const expected = moment().subtract(1, 'months').endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'last day of this month' (explicit 'this' prefix)", () => {
        const result = parser.getParsedDate('last day of this month', weekStartPreference);
        const expected = moment().endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'first Monday of month' (current month)", () => {
        const result = parser.getParsedDate('first Monday of month', weekStartPreference);
        const expected = moment().startOf('month');
        // Find first Monday of current month
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'first Monday of next month'", () => {
        const result = parser.getParsedDate('first Monday of next month', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month');
        // Find first Monday of next month
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'last Monday of month' (current month)", () => {
        const result = parser.getParsedDate('last Monday of month', weekStartPreference);
        const expected = moment().endOf('month');
        // Find last Monday of current month
        while (expected.day() !== 1) {
          expected.subtract(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'last Monday of next month'", () => {
        const result = parser.getParsedDate('last Monday of next month', weekStartPreference);
        const expected = moment().add(1, 'months').endOf('month');
        // Find last Monday of next month
        while (expected.day() !== 1) {
          expected.subtract(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'last Friday of last month'", () => {
        const result = parser.getParsedDate('last Friday of last month', weekStartPreference);
        const expected = moment().subtract(1, 'months').endOf('month');
        while (expected.day() !== 5) {
          expected.subtract(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(5); // Friday
      });

      it("should parse 'last Friday of this month' (explicit 'this' month prefix)", () => {
        const result = parser.getParsedDate('last Friday of this month', weekStartPreference);
        const expected = moment().endOf('month');
        while (expected.day() !== 5) {
          expected.subtract(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(5); // Friday
      });

      it("should parse 'first Friday of last month'", () => {
        const result = parser.getParsedDate('first Friday of last month', weekStartPreference);
        const expected = moment().subtract(1, 'months').startOf('month');
        while (expected.day() !== 5) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(5); // Friday
      });

      it("should parse 'first Friday of month'", () => {
        const result = parser.getParsedDate('first Friday of month', weekStartPreference);
        const expected = moment().startOf('month');
        // Find first Friday of current month
        while (expected.day() !== 5) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(5); // Friday
      });

      // "next"/"this" directly before the weekday (not "first"/"last") isn't
      // itself a month shift -- it hits the same "default to first weekday"
      // path as bare "of month", and only shifts month when a prefix appears
      // next to the month word itself ("next Monday of next month"). These
      // pin down both halves of that branch, which had no coverage before.
      it("should parse 'next Monday of month' as the first Monday of THIS month (no month shift)", () => {
        const result = parser.getParsedDate('next Monday of month', weekStartPreference);
        const expected = moment().startOf('month');
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'next Monday of next month' as the first Monday of next month", () => {
        const result = parser.getParsedDate('next Monday of next month', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month');
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'this Monday of month' the same as 'next Monday of month'", () => {
        const result = parser.getParsedDate('this Monday of month', weekStartPreference);
        const expected = moment().startOf('month');
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'next Monday of this month' (monthPrefix='this' in the default branch)", () => {
        const result = parser.getParsedDate('next Monday of this month', weekStartPreference);
        const expected = moment().startOf('month');
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
      });
    });

    describe('French', () => {
      it("should parse 'le 15 du mois prochain'", () => {
        const result = parser.getParsedDate('le 15 du mois prochain', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse 'le 15ème du mois prochain'", () => {
        const result = parser.getParsedDate('le 15ème du mois prochain', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse 'dernier jour du mois' (current month)", () => {
        const result = parser.getParsedDate('dernier jour du mois', weekStartPreference);
        const expected = moment().endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'dernier jour du mois prochain'", () => {
        const result = parser.getParsedDate('dernier jour du mois prochain', weekStartPreference);
        const expected = moment().add(1, 'months').endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'premier lundi du mois' (current month)", () => {
        const result = parser.getParsedDate('premier lundi du mois', weekStartPreference);
        const expected = moment().startOf('month');
        // Find first Monday of current month
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'premier lundi du mois prochain'", () => {
        const result = parser.getParsedDate('premier lundi du mois prochain', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month');
        // Find first Monday of next month
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("should parse 'dernier lundi du mois' (current month)", () => {
        const result = parser.getParsedDate('dernier lundi du mois', weekStartPreference);
        const expected = moment().endOf('month');
        // Find last Monday of current month
        while (expected.day() !== 1) {
          expected.subtract(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('German', () => {
      it("should parse 'der 15. des nächsten Monats'", () => {
        const result = parser.getParsedDate('der 15 des nächsten Monats', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse 'letzter Tag des Monats'", () => {
        const result = parser.getParsedDate('letzter Tag des Monats', weekStartPreference);
        const expected = moment().endOf('month');
        expectSameDate(result, expected, 'day');
      });

      it("should parse 'erster Montag des Monats'", () => {
        const result = parser.getParsedDate('erster Montag des Monats', weekStartPreference);
        const expected = moment().startOf('month');
        while (expected.day() !== 1) {
          expected.add(1, 'day');
        }
        expectSameDate(result, expected, 'day');
        expect(moment(result).day()).toBe(1);
      });
    });

    describe('Spanish', () => {
      it("should parse 'el 15 del próximo mes'", () => {
        const result = parser.getParsedDate('el 15 del próximo mes', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(15);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(15);
      });

      it("should parse 'último día del mes'", () => {
        const result = parser.getParsedDate('último día del mes', weekStartPreference);
        const expected = moment().endOf('month');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Edge cases for complex expressions', () => {
      it("should handle 'the 31st of next month' when next month has 30 days (should clamp to 30)", () => {
        // Test with a month that has 30 days
        const result = parser.getParsedDate('the 31st of next month', weekStartPreference);
        const nextMonth = moment().add(1, 'months');
        const daysInNextMonth = nextMonth.daysInMonth();
        expect(moment(result).date()).toBeLessThanOrEqual(daysInNextMonth);
        expect(moment(result).month()).toBe(nextMonth.month());
      });

      it("should handle 'the 1st of this month'", () => {
        const result = parser.getParsedDate('the 1st of this month', weekStartPreference);
        const expected = moment().startOf('month').date(1);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(1);
      });

      it("should parse ordinal words like 'first' in 'the first of next month'", () => {
        const result = parser.getParsedDate('the first of next month', weekStartPreference);
        const expected = moment().add(1, 'months').startOf('month').date(1);
        expectSameDate(result, expected, 'day');
        expect(moment(result).date()).toBe(1);
      });
    });
  });
});

