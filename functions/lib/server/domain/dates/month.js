"use strict";
/**
 * Month value object - represents a calendar month
 * Pure type + math. No IO, no randomness, no time.
 *
 * INVARIANT: Months are represented as YYYY-MM strings
 * INVARIANT: All date arithmetic is deterministic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMonth = createMonth;
exports.parseMonth = parseMonth;
exports.formatMonth = formatMonth;
exports.getMonthStart = getMonthStart;
exports.getMonthEnd = getMonthEnd;
exports.getDaysInMonth = getDaysInMonth;
exports.isLeapYear = isLeapYear;
exports.addMonths = addMonths;
exports.subtractMonths = subtractMonths;
exports.nextMonth = nextMonth;
exports.previousMonth = previousMonth;
exports.compareMonths = compareMonths;
exports.monthsEqual = monthsEqual;
exports.monthFromDate = monthFromDate;
/**
 * Creates a Month from year and month numbers
 * @throws if month is not 1-12 or year is invalid
 */
function createMonth(year, month) {
    assertValidYear(year);
    assertValidMonth(month);
    return { year, month };
}
/**
 * Parses a Month from YYYY-MM string
 * @throws if format is invalid
 */
function parseMonth(str) {
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
function formatMonth(m) {
    const mm = m.month.toString().padStart(2, "0");
    return `${m.year}-${mm}`;
}
/**
 * Gets the first day of the month as YYYY-MM-DD
 */
function getMonthStart(m) {
    const mm = m.month.toString().padStart(2, "0");
    return `${m.year}-${mm}-01`;
}
/**
 * Gets the last day of the month as YYYY-MM-DD
 */
function getMonthEnd(m) {
    const lastDay = getDaysInMonth(m);
    const mm = m.month.toString().padStart(2, "0");
    const dd = lastDay.toString().padStart(2, "0");
    return `${m.year}-${mm}-${dd}`;
}
/**
 * Returns the number of days in the month
 */
function getDaysInMonth(m) {
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
function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
/**
 * Adds N months to a Month
 */
function addMonths(m, count) {
    const totalMonths = (m.year * 12 + (m.month - 1)) + count;
    const newYear = Math.floor(totalMonths / 12);
    const newMonth = (totalMonths % 12) + 1;
    return createMonth(newYear, newMonth);
}
/**
 * Subtracts N months from a Month
 */
function subtractMonths(m, count) {
    return addMonths(m, -count);
}
/**
 * Gets the next month
 */
function nextMonth(m) {
    return addMonths(m, 1);
}
/**
 * Gets the previous month
 */
function previousMonth(m) {
    return addMonths(m, -1);
}
/**
 * Compares two months: returns -1, 0, or 1
 */
function compareMonths(a, b) {
    if (a.year < b.year)
        return -1;
    if (a.year > b.year)
        return 1;
    if (a.month < b.month)
        return -1;
    if (a.month > b.month)
        return 1;
    return 0;
}
/**
 * Checks if two months are equal
 */
function monthsEqual(a, b) {
    return a.year === b.year && a.month === b.month;
}
/**
 * Extracts Month from a YYYY-MM-DD date string
 */
function monthFromDate(dateStr) {
    const match = dateStr.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!match) {
        throw new Error(`Invalid date format: '${dateStr}'. Expected YYYY-MM-DD.`);
    }
    return createMonth(parseInt(match[1], 10), parseInt(match[2], 10));
}
// ============================================================================
// INTERNAL HELPERS
// ============================================================================
function assertValidYear(year) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
        throw new Error(`Invalid year: ${year}. Must be integer between 1900 and 2100.`);
    }
}
function assertValidMonth(month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`Invalid month: ${month}. Must be integer between 1 and 12.`);
    }
}
//# sourceMappingURL=month.js.map