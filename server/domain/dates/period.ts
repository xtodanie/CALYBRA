/**
 * Period value object - represents a date range
 * Pure type + math. No IO, no randomness, no time.
 *
 * INVARIANT: Periods are represented as inclusive [start, end] ranges
 * INVARIANT: Dates are YYYY-MM-DD strings
 */

/**
 * A date period with inclusive start and end dates
 */
export interface Period {
  readonly start: string; // YYYY-MM-DD
  readonly end: string; // YYYY-MM-DD
}

/**
 * Creates a Period from start and end dates
 * @throws if dates are invalid or start > end
 */
export function createPeriod(start: string, end: string): Period {
  assertValidDate(start);
  assertValidDate(end);

  if (compareDates(start, end) > 0) {
    throw new Error(`Invalid period: start (${start}) is after end (${end}).`);
  }

  return { start, end };
}

/**
 * Checks if a date is within a period (inclusive)
 */
export function isDateInPeriod(date: string, period: Period): boolean {
  assertValidDate(date);
  return compareDates(date, period.start) >= 0 && compareDates(date, period.end) <= 0;
}

/**
 * Checks if two periods overlap
 */
export function periodsOverlap(a: Period, b: Period): boolean {
  return compareDates(a.start, b.end) <= 0 && compareDates(b.start, a.end) <= 0;
}

/**
 * Checks if period A fully contains period B
 */
export function periodContains(outer: Period, inner: Period): boolean {
  return compareDates(outer.start, inner.start) <= 0 && compareDates(outer.end, inner.end) >= 0;
}

/**
 * Calculates the number of days in a period (inclusive)
 */
export function getPeriodDays(period: Period): number {
  const startDays = dateToDayNumber(period.start);
  const endDays = dateToDayNumber(period.end);
  return endDays - startDays + 1;
}

/**
 * Compares two dates: returns -1, 0, or 1
 */
export function compareDates(a: string, b: string): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Checks if two dates are equal
 */
export function datesEqual(a: string, b: string): boolean {
  return a === b;
}

/**
 * Adds N days to a date
 */
export function addDays(date: string, days: number): string {
  const dayNumber = dateToDayNumber(date) + days;
  return dayNumberToDate(dayNumber);
}

/**
 * Subtracts N days from a date
 */
export function subtractDays(date: string, days: number): string {
  return addDays(date, -days);
}

/**
 * Gets the day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(date: string): number {
  const dayNumber = dateToDayNumber(date);
  // Jan 1, 1970 was a Thursday (4)
  return (dayNumber + 4) % 7;
}

/**
 * Parses a date string and validates format
 */
export function parseDate(str: string): { year: number; month: number; day: number } {
  assertValidDate(str);
  const [year, month, day] = str.split("-").map((s) => parseInt(s, 10));
  return { year, month, day };
}

/**
 * Formats date components to YYYY-MM-DD string
 */
export function formatDate(year: number, month: number, day: number): string {
  const mm = month.toString().padStart(2, "0");
  const dd = day.toString().padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function assertValidDate(date: string): void {
  if (!DATE_REGEX.test(date)) {
    throw new Error(`Invalid date format: '${date}'. Expected YYYY-MM-DD.`);
  }

  const { year, month, day } = parseDate(date);

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in date: ${date}`);
  }

  const daysInMonth = getDaysInMonthForDate(year, month);
  if (day < 1 || day > daysInMonth) {
    throw new Error(`Invalid day in date: ${date}`);
  }
}

function getDaysInMonthForDate(year: number, month: number): number {
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let days = daysPerMonth[month - 1];

  if (month === 2 && isLeapYearCheck(year)) {
    days = 29;
  }

  return days;
}

function isLeapYearCheck(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Converts a YYYY-MM-DD date to a day number (days since epoch 1970-01-01 = 0)
 */
function dateToDayNumber(date: string): number {
  const { year, month, day } = parseDate(date);

  // Days from year 0 to start of given year
  let days = year * 365 + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);

  // Days in months before given month
  const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  days += daysBeforeMonth[month - 1];

  // Add leap day if applicable
  if (month > 2 && isLeapYearCheck(year)) {
    days += 1;
  }

  days += day;

  // Adjust to epoch (1970-01-01)
  const epoch = 719528; // Days from year 0 to 1970-01-01
  return days - epoch;
}

/**
 * Converts a day number back to YYYY-MM-DD
 */
function dayNumberToDate(dayNumber: number): string {
  const epoch = 719528;
  const days = dayNumber + epoch;

  // Approximate year
  let year = Math.floor(days / 365.2425);
  let daysInYear = year * 365 + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);

  while (daysInYear >= days) {
    year--;
    daysInYear = year * 365 + Math.floor((year - 1) / 4) - Math.floor((year - 1) / 100) + Math.floor((year - 1) / 400);
  }

  let remainingDays = days - daysInYear;

  // Find month
  const isLeap = isLeapYearCheck(year);
  const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let month = 1;
  while (remainingDays > daysInMonths[month - 1]) {
    remainingDays -= daysInMonths[month - 1];
    month++;
  }

  return formatDate(year, month, remainingDays);
}
