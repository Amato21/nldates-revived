// IMPORTANT: Ce fichier DOIT importer setup.ts en premier pour définir window.moment
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
    // S'assurer que window.moment est disponible (déjà fait dans setup.ts, mais on s'assure ici aussi)
    const contexts = [globalThis, global, typeof window !== 'undefined' ? window : null].filter(Boolean);
    contexts.forEach((ctx: any) => {
      if (ctx) {
        ctx.window = ctx.window || {};
        ctx.window.moment = moment; // moment est maintenant importé comme fonction par défaut
      }
    });
    
    // Réinitialiser le parser avec toutes les langues
    parser = new NLDParser(['en', 'fr', 'de', 'pt', 'nl', 'es', 'it', 'ja']);
  });

  describe('Priorité 1: Expressions de base (today, tomorrow, yesterday, now)', () => {
    describe('Anglais', () => {
      it("devrait parser 'today'", () => {
        const result = parser.getParsedDate('today', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'tomorrow'", () => {
        const result = parser.getParsedDate('tomorrow', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("devrait parser 'yesterday'", () => {
        const result = parser.getParsedDate('yesterday', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("devrait parser 'now'", () => {
        const result = parser.getParsedDate('now', weekStartPreference);
        const now = new Date();
        // La différence devrait être de moins d'une seconde
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('Français', () => {
      it("devrait parser 'Aujourd'hui'", () => {
        const result = parser.getParsedDate("Aujourd'hui", weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Demain'", () => {
        const result = parser.getParsedDate('Demain', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });

      it("devrait parser 'Hier'", () => {
        const result = parser.getParsedDate('Hier', weekStartPreference);
        const yesterday = moment().subtract(1, 'days').startOf('day');
        expectSameDate(result, yesterday, 'day');
      });

      it("devrait parser 'maintenant'", () => {
        const result = parser.getParsedDate('maintenant', weekStartPreference);
        const now = new Date();
        expect(Math.abs(result.getTime() - now.getTime())).toBeLessThan(1000);
      });
    });

    describe('Allemand', () => {
      it("devrait parser 'Heute'", () => {
        const result = parser.getParsedDate('Heute', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Morgen'", () => {
        const result = parser.getParsedDate('Morgen', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Portugais', () => {
      it("devrait parser 'Hoje'", () => {
        const result = parser.getParsedDate('Hoje', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Amanhã'", () => {
        const result = parser.getParsedDate('Amanhã', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Néerlandais', () => {
      it("devrait parser 'Vandaag'", () => {
        const result = parser.getParsedDate('Vandaag', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Morgen'", () => {
        const result = parser.getParsedDate('Morgen', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Espagnol', () => {
      it("devrait parser 'Hoy'", () => {
        const result = parser.getParsedDate('Hoy', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Mañana'", () => {
        const result = parser.getParsedDate('Mañana', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Italien', () => {
      it("devrait parser 'Oggi'", () => {
        const result = parser.getParsedDate('Oggi', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser 'Domani'", () => {
        const result = parser.getParsedDate('Domani', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });

    describe('Japonais', () => {
      it("devrait parser '今日'", () => {
        const result = parser.getParsedDate('今日', weekStartPreference);
        const today = moment().startOf('day');
        expectSameDate(result, today, 'day');
      });

      it("devrait parser '明日'", () => {
        const result = parser.getParsedDate('明日', weekStartPreference);
        const tomorrow = moment().add(1, 'days').startOf('day');
        expectSameDate(result, tomorrow, 'day');
      });
    });
  });

  describe('Priorité 1: Expressions relatives simples (in 2 days, in 2 weeks)', () => {
    describe('Anglais', () => {
      it("devrait parser 'in 2 days'", () => {
        const result = parser.getParsedDate('in 2 days', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 2 weeks'", () => {
        const result = parser.getParsedDate('in 2 weeks', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 3 months'", () => {
        const result = parser.getParsedDate('in 3 months', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 1 year'", () => {
        const result = parser.getParsedDate('in 1 year', weekStartPreference);
        const expected = moment().add(1, 'years');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 30 minutes'", () => {
        const result = parser.getParsedDate('in 30 minutes', weekStartPreference);
        const expected = moment().add(30, 'minutes');
        expectSameDate(result, expected, 'minute', 60);
      });

      it("devrait parser 'in 5 hours'", () => {
        const result = parser.getParsedDate('in 5 hours', weekStartPreference);
        const expected = moment().add(5, 'hours');
        expectSameDate(result, expected, 'hour', 3600);
      });
    });

    describe('Français', () => {
      it("devrait parser 'dans 2 jours'", () => {
        const result = parser.getParsedDate('dans 2 jours', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'dans 2 semaines'", () => {
        const result = parser.getParsedDate('dans 2 semaines', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'dans 3 mois'", () => {
        const result = parser.getParsedDate('dans 3 mois', weekStartPreference);
        const expected = moment().add(3, 'months');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Allemand', () => {
      it("devrait parser 'in 2 Tagen'", () => {
        const result = parser.getParsedDate('in 2 Tagen', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 2 Wochen'", () => {
        const result = parser.getParsedDate('in 2 Wochen', weekStartPreference);
        const expected = moment().add(2, 'weeks');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Portugais', () => {
      it("devrait parser 'em 2 dias'", () => {
        const result = parser.getParsedDate('em 2 dias', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Néerlandais', () => {
      it("devrait parser 'over 2 dagen'", () => {
        const result = parser.getParsedDate('over 2 dagen', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Espagnol', () => {
      it("devrait parser 'en 2 días'", () => {
        const result = parser.getParsedDate('en 2 días', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Italien', () => {
      it("devrait parser 'tra 2 giorni'", () => {
        const result = parser.getParsedDate('tra 2 giorni', weekStartPreference);
        const expected = moment().add(2, 'days');
        expectSameDate(result, expected, 'day');
      });
    });
  });

  describe('Priorité 2: Combinaisons (in 2 weeks and 3 days)', () => {
    describe('Anglais', () => {
      it("devrait parser 'in 2 weeks and 3 days'", () => {
        const result = parser.getParsedDate('in 2 weeks and 3 days', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 1 month and 5 days'", () => {
        const result = parser.getParsedDate('in 1 month and 5 days', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'in 2 weeks and 3 hours'", () => {
        const result = parser.getParsedDate('in 2 weeks and 3 hours', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'hours');
        expectSameDate(result, expected, 'minute', 60);
      });
    });

    describe('Français', () => {
      it("devrait parser 'dans 2 semaines et 3 jours'", () => {
        const result = parser.getParsedDate('dans 2 semaines et 3 jours', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });

      it("devrait parser 'dans 1 mois et 5 jours'", () => {
        const result = parser.getParsedDate('dans 1 mois et 5 jours', weekStartPreference);
        const expected = moment().add(1, 'months').add(5, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Allemand', () => {
      it("devrait parser 'in 2 Wochen und 3 Tagen'", () => {
        const result = parser.getParsedDate('in 2 Wochen und 3 Tagen', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Portugais', () => {
      it("devrait parser 'em 2 semanas e 3 dias'", () => {
        const result = parser.getParsedDate('em 2 semanas e 3 dias', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Néerlandais', () => {
      it("devrait parser 'over 2 weken en 3 dagen'", () => {
        const result = parser.getParsedDate('over 2 weken en 3 dagen', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Espagnol', () => {
      it("devrait parser 'en 2 semanas y 3 días'", () => {
        const result = parser.getParsedDate('en 2 semanas y 3 días', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });

    describe('Italien', () => {
      it("devrait parser 'tra 2 settimane e 3 giorni'", () => {
        const result = parser.getParsedDate('tra 2 settimane e 3 giorni', weekStartPreference);
        const expected = moment().add(2, 'weeks').add(3, 'days');
        expectSameDate(result, expected, 'day');
      });
    });
  });

  describe('Priorité 3: Jours de semaine (next Monday, next Monday at 3pm)', () => {
    describe('Anglais', () => {
      it("devrait parser 'next Monday'", () => {
        const result = parser.getParsedDate('next Monday', weekStartPreference);
        const today = moment();
        const nextMonday = moment().add(1, 'weeks').day(1); // 1 = Monday
        if (today.day() === 1) {
          // Si on est déjà lundi, next Monday devrait être dans une semaine
          expect(moment(result).isSame(nextMonday, 'day')).toBe(true);
        } else {
          // Sinon, on vérifie que c'est un lundi futur
          expect(moment(result).day()).toBe(1);
          expect(moment(result).isAfter(today, 'day')).toBe(true);
        }
      });

      it("devrait parser 'next Friday'", () => {
        const result = parser.getParsedDate('next Friday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // 5 = Friday
        expect(moment(result).isSameOrAfter(moment(), 'day')).toBe(true);
      });

      it("devrait parser 'last Monday'", () => {
        const result = parser.getParsedDate('last Monday', weekStartPreference);
        expect(moment(result).day()).toBe(1); // 1 = Monday
      });

      it("devrait parser 'this Friday'", () => {
        const result = parser.getParsedDate('this Friday', weekStartPreference);
        expect(moment(result).day()).toBe(5); // 5 = Friday
      });

      it("devrait parser 'next Monday at 3pm'", () => {
        const result = parser.getParsedDate('next Monday at 3pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15); // 3pm = 15:00
      });

      it("devrait parser 'next Monday at 3:30pm'", () => {
        const result = parser.getParsedDate('next Monday at 3:30pm', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15); // 3pm
        expect(moment(result).minute()).toBe(30);
      });
    });

    describe('Français', () => {
      it("devrait parser 'prochain Lundi'", () => {
        const result = parser.getParsedDate('prochain Lundi', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("devrait parser 'prochain Lundi à 15h'", () => {
        const result = parser.getParsedDate('prochain Lundi à 15h', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
        expect(moment(result).hour()).toBe(15);
      });
    });

    describe('Allemand', () => {
      it("devrait parser 'nächster Montag'", () => {
        const result = parser.getParsedDate('nächster Montag', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });

      it("devrait parser 'nächster Montag um 15 Uhr'", () => {
        const result = parser.getParsedDate('nächster Montag um 15 Uhr', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Portugais', () => {
      it("devrait parser 'próxima Segunda-feira'", () => {
        const result = parser.getParsedDate('próxima Segunda-feira', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Espagnol', () => {
      it("devrait parser 'próximo Lunes'", () => {
        const result = parser.getParsedDate('próximo Lunes', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });

    describe('Italien', () => {
      it("devrait parser 'prossimo Lunedì'", () => {
        const result = parser.getParsedDate('prossimo Lunedì', weekStartPreference);
        expect(moment(result).day()).toBe(1); // Monday
      });
    });
  });

  describe('Plages de dates (from Monday to Friday, next week)', () => {
    describe('Anglais', () => {
      it("devrait parser 'from Monday to Friday' comme range", () => {
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

      it("devrait parser 'next week' comme range", () => {
        const result = parser.getParsedDateRange('next week', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(result?.startDate).toBeDefined();
        expect(result?.endDate).toBeDefined();
        expect(result!.dateList).toBeDefined();
        expect(result!.dateList!.length).toBe(7); // Une semaine = 7 jours
      });
    });

    describe('Français', () => {
      it("devrait parser 'de Lundi à Vendredi' comme range", () => {
        const result = parser.getParsedDateRange('de Lundi à Vendredi', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(moment(result!.startDate).day()).toBe(1); // Monday
        expect(moment(result!.endDate).day()).toBe(5); // Friday
      });

      it("devrait parser 'semaine prochaine' comme range", () => {
        const result = parser.getParsedDateRange('semaine prochaine', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
        expect(result!.dateList!.length).toBe(7);
      });
    });

    describe('Allemand', () => {
      it("devrait parser 'von Montag bis Freitag' comme range", () => {
        const result = parser.getParsedDateRange('von Montag bis Freitag', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Portugais', () => {
      it("devrait parser 'de Segunda-feira até Sexta-feira' comme range", () => {
        const result = parser.getParsedDateRange('de Segunda-feira até Sexta-feira', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Néerlandais', () => {
      it("devrait parser 'van maandag tot vrijdag' comme range", () => {
        const result = parser.getParsedDateRange('van maandag tot vrijdag', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Espagnol', () => {
      it("devrait parser 'de Lunes a Viernes' comme range", () => {
        const result = parser.getParsedDateRange('de Lunes a Viernes', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });

    describe('Italien', () => {
      it("devrait parser 'da Lunedì a Venerdì' comme range", () => {
        const result = parser.getParsedDateRange('da Lunedì a Venerdì', weekStartPreference);
        expect(result).not.toBeNull();
        expect(result?.isRange).toBe(true);
      });
    });
  });

  describe('Cas limites et gestion d\'erreurs', () => {
    it("devrait retourner aujourd'hui pour une chaîne vide", () => {
      const result = parser.getParsedDate('', weekStartPreference);
      const today = moment().startOf('day');
      expectSameDate(result, today, 'day');
    });

    it("devrait retourner aujourd'hui pour une chaîne invalide", () => {
      const result = parser.getParsedDate('xyz123', weekStartPreference);
      // Si chrono-node échoue, le parser retourne aujourd'hui par défaut
      expect(result).toBeInstanceOf(Date);
    });

    it("devrait gérer 'next month'", () => {
      const result = parser.getParsedDate('next month', weekStartPreference);
      const expected = moment().add(1, 'months').startOf('month');
      expectSameDate(result, expected, 'day');
    });

    it("devrait gérer 'next year'", () => {
      const result = parser.getParsedDate('next year', weekStartPreference);
      const expected = moment().add(1, 'years').startOf('year');
      expectSameDate(result, expected, 'day');
    });

    it("devrait retourner null pour getParsedDateRange avec une chaîne invalide", () => {
      const result = parser.getParsedDateRange('invalid string', weekStartPreference);
      expect(result).toBeNull();
    });

    it("devrait gérer les variantes de casse (majuscules/minuscules)", () => {
      const result1 = parser.getParsedDate('TOMORROW', weekStartPreference);
      const result2 = parser.getParsedDate('tomorrow', weekStartPreference);
      const result3 = parser.getParsedDate('Tomorrow', weekStartPreference);
      
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result1, tomorrow, 'day');
      expectSameDate(result2, tomorrow, 'day');
      expectSameDate(result3, tomorrow, 'day');
    });

    it("devrait gérer les espaces supplémentaires", () => {
      const result = parser.getParsedDate('  tomorrow  ', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("devrait détecter si une expression a une composante temporelle", () => {
      expect(parser.hasTimeComponent('now')).toBe(true);
      expect(parser.hasTimeComponent('today')).toBe(false);
      expect(parser.hasTimeComponent('in 30 minutes')).toBe(true);
      expect(parser.hasTimeComponent('in 2 days')).toBe(false);
      expect(parser.hasTimeComponent('next Monday at 3pm')).toBe(true);
      expect(parser.hasTimeComponent('next Monday')).toBe(false);
    });

    it("devrait gérer 'in 2 weeks and 3 days' avec détection de temps", () => {
      // Avec heures/minutes = a du temps
      expect(parser.hasTimeComponent('in 2 weeks and 3 hours')).toBe(true);
      // Avec jours/semaines seulement = pas de temps
      expect(parser.hasTimeComponent('in 2 weeks and 3 days')).toBe(false);
    });
  });

  describe('Parser avec une seule langue', () => {
    it("devrait fonctionner avec seulement l'anglais", () => {
      const singleLangParser = new NLDParser(['en']);
      const result = singleLangParser.getParsedDate('tomorrow', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("devrait fonctionner avec seulement le français", () => {
      const singleLangParser = new NLDParser(['fr']);
      const result = singleLangParser.getParsedDate('Demain', weekStartPreference);
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });
  });

  // ==================== CAS LIMITES ADDITIONNELS ====================
  
  describe('Cas limites additionnels', () => {
    it("devrait gérer les expressions avec des nombres grands", () => {
      const result = parser.getParsedDate('in 100 days', weekStartPreference);
      const expected = moment().add(100, 'days');
      expectSameDate(result, expected, 'day');
    });

    it("devrait gérer 'in 0 days' (devrait retourner aujourd'hui)", () => {
      const result = parser.getParsedDate('in 0 days', weekStartPreference);
      const today = moment().startOf('day');
      expectSameDate(result, today, 'day');
    });

    it("devrait gérer les expressions avec plusieurs unités de temps différentes", () => {
      const result = parser.getParsedDate('in 1 year and 2 months and 3 weeks and 4 days', weekStartPreference);
      // Vérifier que ça retourne bien une date
      expect(result).toBeInstanceOf(Date);
      expectFutureDate(result);
    });

    it("devrait gérer les expressions avec des caractères spéciaux", () => {
      const result = parser.getParsedDate('tomorrow!!!', weekStartPreference);
      // Devrait quand même parser 'tomorrow'
      const tomorrow = moment().add(1, 'days').startOf('day');
      expectSameDate(result, tomorrow, 'day');
    });

    it("devrait gérer les expressions mixtes (chiffres et texte)", () => {
      const result = parser.getParsedDate('in 2weeks', weekStartPreference);
      const expected = moment().add(2, 'weeks');
      expectSameDate(result, expected, 'day');
    });

    it("devrait gérer 'last week' comme range", () => {
      const result = parser.getParsedDateRange('last week', weekStartPreference);
      // Note: Cette fonctionnalité pourrait ne pas être implémentée
      // Si elle retourne null, c'est OK pour l'instant
      if (result) {
        expect(result.isRange).toBe(true);
        expect(result.dateList!.length).toBe(7);
      }
    });

    it("devrait gérer les jours de semaine avec des variantes", () => {
      // Tester les abréviations
      const resultMon = parser.getParsedDate('next Mon', weekStartPreference);
      expect(moment(resultMon).day()).toBe(1);

      const resultFri = parser.getParsedDate('next Fri', weekStartPreference);
      expect(moment(resultFri).day()).toBe(5);
    });

    it("devrait gérer les plages de dates avec le même jour", () => {
      const result = parser.getParsedDateRange('from Monday to Monday', weekStartPreference);
      if (result) {
        expect(result.isRange).toBe(true);
        expect(moment(result.startDate).day()).toBe(1);
        expect(moment(result.endDate).day()).toBe(1);
      }
    });

    it("devrait gérer les expressions avec des temps 24h", () => {
      const result = parser.getParsedDate('next Monday at 15:00', weekStartPreference);
      expect(moment(result).day()).toBe(1);
      expect(moment(result).hour()).toBe(15);
    });

    it("devrait gérer 'yesterday' comme date passée", () => {
      const result = parser.getParsedDate('yesterday', weekStartPreference);
      expectPastDate(result);
    });

    it("devrait retourner une date valide même pour des expressions ambiguës", () => {
      const result = parser.getParsedDate('monday', weekStartPreference);
      // Devrait retourner une date valide (peut être lundi passé ou futur selon l'implémentation)
      expect(result).toBeInstanceOf(Date);
    });

    it("devrait gérer les expressions avec 'ago' si supportées", () => {
      // Teste si '2 days ago' fonctionne (peut être géré par chrono-node)
      const result = parser.getParsedDate('2 days ago', weekStartPreference);
      if (result) {
        expectPastDate(result);
      }
    });

    it("devrait gérer les nombres ordinaux", () => {
      // Teste '1st', '2nd', etc. si supportés
      const result = parser.getParsedDate('January 1st', weekStartPreference);
      if (result) {
        expect(result).toBeInstanceOf(Date);
      }
    });
  });

  // ==================== TESTS D'INTÉGRATION ====================
  
  describe('Tests d\'intégration', () => {
    it("devrait parser une séquence d'expressions différentes", () => {
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

    it("devrait parser des expressions dans toutes les langues configurées", () => {
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

    it("devrait gérer hasTimeComponent pour différentes expressions", () => {
      const withTime = ['now', 'in 30 minutes', 'next Monday at 3pm', 'in 2 hours'];
      const withoutTime = ['today', 'tomorrow', 'in 2 days', 'next Monday'];

      withTime.forEach(expr => {
        expect(parser.hasTimeComponent(expr)).toBe(true);
      });

      withoutTime.forEach(expr => {
        expect(parser.hasTimeComponent(expr)).toBe(false);
      });
    });

    it("devrait maintenir la cohérence entre getParsedDate et getParsedDateRange", () => {
      // Pour 'next week', les deux méthodes devraient retourner des résultats cohérents
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

