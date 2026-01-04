import moment from 'moment';

/**
 * Vérifie que deux dates sont les mêmes avec une tolérance
 * @param actual Date réelle
 * @param expected Date attendue
 * @param precision Précision de comparaison ('year', 'month', 'day', 'hour', 'minute', 'second')
 * @param toleranceSeconds Tolérance en secondes (par défaut 60 pour les minutes, 3600 pour les heures, etc.)
 */
export function expectSameDate(
  actual: Date,
  expected: Date | moment.Moment,
  precision: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' = 'day',
  toleranceSeconds?: number
): void {
  const actualMoment = moment(actual);
  const expectedMoment = moment.isMoment(expected) ? expected : moment(expected);

  // Définir la tolérance par défaut selon la précision
  if (toleranceSeconds === undefined) {
    switch (precision) {
      case 'second':
        toleranceSeconds = 1;
        break;
      case 'minute':
        toleranceSeconds = 60;
        break;
      case 'hour':
        toleranceSeconds = 3600;
        break;
      case 'day':
        toleranceSeconds = 86400; // 24 heures
        break;
      default:
        toleranceSeconds = 0;
    }
  }

  // Si on compare au niveau du jour ou plus, utiliser isSame
  if (['year', 'month', 'day'].includes(precision)) {
    expect(actualMoment.isSame(expectedMoment, precision)).toBe(true);
  } else {
    // Pour les heures/minutes/secondes, utiliser une tolérance
    const diff = Math.abs(actualMoment.diff(expectedMoment, 'seconds'));
    expect(diff).toBeLessThanOrEqual(toleranceSeconds);
  }
}

/**
 * Vérifie qu'une date est dans une plage de dates
 */
export function expectDateInRange(
  date: Date,
  start: Date | moment.Moment,
  end: Date | moment.Moment
): void {
  const dateMoment = moment(date);
  const startMoment = moment.isMoment(start) ? start : moment(start);
  const endMoment = moment.isMoment(end) ? end : moment(end);

  expect(dateMoment.isSameOrAfter(startMoment, 'day')).toBe(true);
  expect(dateMoment.isSameOrBefore(endMoment, 'day')).toBe(true);
}

/**
 * Vérifie qu'une date est dans le futur
 */
export function expectFutureDate(date: Date, fromDate: Date = new Date()): void {
  const dateMoment = moment(date);
  const fromMoment = moment(fromDate);
  expect(dateMoment.isAfter(fromMoment)).toBe(true);
}

/**
 * Vérifie qu'une date est dans le passé
 */
export function expectPastDate(date: Date, fromDate: Date = new Date()): void {
  const dateMoment = moment(date);
  const fromMoment = moment(fromDate);
  expect(dateMoment.isBefore(fromMoment)).toBe(true);
}

/**
 * Crée une date fixe pour les tests (pour éviter les problèmes de timing)
 */
export function createTestDate(
  year: number,
  month: number,
  day: number,
  hour: number = 0,
  minute: number = 0
): Date {
  return moment({ year, month: month - 1, day, hour, minute }).toDate();
}

