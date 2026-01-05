import moment from 'moment';

/**
 * Verifies that two dates are the same with a tolerance
 * @param actual Actual date
 * @param expected Expected date
 * @param precision Comparison precision ('year', 'month', 'day', 'hour', 'minute', 'second')
 * @param toleranceSeconds Tolerance in seconds (default 60 for minutes, 3600 for hours, etc.)
 */
export function expectSameDate(
  actual: Date,
  expected: Date | moment.Moment,
  precision: 'year' | 'month' | 'day' | 'hour' | 'minute' | 'second' = 'day',
  toleranceSeconds?: number
): void {
  const actualMoment = moment(actual);
  const expectedMoment = moment.isMoment(expected) ? expected : moment(expected);

  // Set default tolerance according to precision
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
        toleranceSeconds = 86400; // 24 hours
        break;
      default:
        toleranceSeconds = 0;
    }
  }

  // If comparing at day level or higher, use isSame
  if (['year', 'month', 'day'].includes(precision)) {
    expect(actualMoment.isSame(expectedMoment, precision)).toBe(true);
  } else {
    // For hours/minutes/seconds, use a tolerance
    const diff = Math.abs(actualMoment.diff(expectedMoment, 'seconds'));
    expect(diff).toBeLessThanOrEqual(toleranceSeconds);
  }
}

/**
 * Verifies that a date is within a date range
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
 * Verifies that a date is in the future
 */
export function expectFutureDate(date: Date, fromDate: Date = new Date()): void {
  const dateMoment = moment(date);
  const fromMoment = moment(fromDate);
  expect(dateMoment.isAfter(fromMoment)).toBe(true);
}

/**
 * Verifies that a date is in the past
 */
export function expectPastDate(date: Date, fromDate: Date = new Date()): void {
  const dateMoment = moment(date);
  const fromMoment = moment(fromDate);
  expect(dateMoment.isBefore(fromMoment)).toBe(true);
}

/**
 * Creates a fixed date for tests (to avoid timing issues)
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

