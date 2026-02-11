/**
 * Month value object - represents a calendar month
 * Pure type + math. No IO, no randomness, no time.
 *
 * INVARIANT: Months are represented as YYYY-MM strings
 * INVARIANT: All date arithmetic is deterministic
 */

/**
 * A calendar month represented as YYYY-MM
 */
export interface Month {
  readonly year: number;
  readonly month: number; // 1-12
}

/**
 * Creates a Month from year and month numbers
 * @throws if month is not 1-12 or year is invalid
 */
export function createMonth(year: number, month: number): Month {
  assertValidYear(year);
  assertValidMonth(month);
  return { year, month };
}

/**
 * Parses a Month from YYYY-MM string
 * @throws if format is invalid
 */
export function parseMonth(str: string): Month {
  const match = str.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid month format: '${str}'. Expected YYYY-MM.`);
  }
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  return createMonth(year, month);
}

/**
 * Formats a Month to YYYY-MM string
 */
export function formatMonth(m: Month): string {
  const mm = m.month.toString().padStart(2, "0");
  return `${m.year}-${mm}`;
}

/**
 * Gets the first day of the month as YYYY-MM-DD
 */
export function getMonthStart(m: Month): string {
  const mm = m.month.toString().padStart(2, "0");
  return `${m.year}-${mm}-01`;
}

/**
 * Gets the last day of the month as YYYY-MM-DD
 */
export function getMonthEnd(m: Month): string {
  const lastDay = getDaysInMonth(m);
  const mm = m.month.toString().padStart(2, "0");
  const dd = lastDay.toString().padStart(2, "0");
  return `${m.year}-${mm}-${dd}`;
}

/**
 * Returns the number of days in the month
 */
export function getDaysInMonth(m: Month): number {
  // Days per month (non-leap year)
  const daysPerMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let days = daysPerMonth[m.month - 1];

  // February leap year check
  if (m.month === 2 && isLeapYear(m.year)) {
    days = 29;
  }

  return days;
}

/**
 * Checks if a year is a leap year
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Adds N months to a Month
 */
export function addMonths(m: Month, count: number): Month {
  const totalMonths = (m.year * 12 + (m.month - 1)) + count;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return createMonth(newYear, newMonth);
}

/**
 * Subtracts N months from a Month
 */
export function subtractMonths(m: Month, count: number): Month {
  return addMonths(m, -count);
}

/**
 * Gets the next month
 */
export function nextMonth(m: Month): Month {
  return addMonths(m, 1);
}

/**
 * Gets the previous month
 */
export function previousMonth(m: Month): Month {
  return addMonths(m, -1);
}

/**
 * Compares two months: returns -1, 0, or 1
 */
export function compareMonths(a: Month, b: Month): -1 | 0 | 1 {
  if (a.year < b.year) return -1;
  if (a.year > b.year) return 1;
  if (a.month < b.month) return -1;
  if (a.month > b.month) return 1;
  return 0;
}

/**
 * Checks if two months are equal
 */
export function monthsEqual(a: Month, b: Month): boolean {
  return a.year === b.year && a.month === b.month;
}

/**
 * Extracts Month from a YYYY-MM-DD date string
 */
export function monthFromDate(dateStr: string): Month {
  const match = dateStr.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) {
    throw new Error(`Invalid date format: '${dateStr}'. Expected YYYY-MM-DD.`);
  }
  return createMonth(parseInt(match[1], 10), parseInt(match[2], 10));
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function assertValidYear(year: number): void {
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error(`Invalid year: ${year}. Must be integer between 1900 and 2100.`);
  }
}

function assertValidMonth(month: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be integer between 1 and 12.`);
  }
}
