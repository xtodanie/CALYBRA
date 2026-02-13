"use strict";
/**
 * Amount value object - monetary amounts with deterministic math
 * Pure type + math. No IO, no randomness, no time.
 *
 * INVARIANT: All monetary calculations use integer arithmetic (cents)
 * to avoid floating-point precision issues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.amountFromCents = amountFromCents;
exports.amountFromDecimal = amountFromDecimal;
exports.amountToDecimal = amountToDecimal;
exports.addAmounts = addAmounts;
exports.subtractAmounts = subtractAmounts;
exports.multiplyAmount = multiplyAmount;
exports.sumAmounts = sumAmounts;
exports.absAmount = absAmount;
exports.negateAmount = negateAmount;
exports.amountsEqual = amountsEqual;
exports.isZero = isZero;
exports.isPositive = isPositive;
exports.isNegative = isNegative;
exports.compareAmounts = compareAmounts;
const currency_1 = require("./currency");
/**
 * Creates an Amount from cents (integer)
 * @throws if cents is not a safe integer
 */
function amountFromCents(cents, currency) {
    if (!Number.isSafeInteger(cents)) {
        throw new Error(`Amount cents must be a safe integer, got: ${cents}`);
    }
    return { cents, currency };
}
/**
 * Creates an Amount from a decimal value (e.g., 123.45 EUR)
 * Rounds to the nearest cent using banker's rounding (round half to even)
 */
function amountFromDecimal(value, currency) {
    const decimals = (0, currency_1.getDecimalPlaces)(currency);
    const multiplier = Math.pow(10, decimals);
    const cents = bankersRound(value * multiplier);
    return amountFromCents(cents, currency);
}
/**
 * Converts an Amount to its decimal representation
 */
function amountToDecimal(amount) {
    const decimals = (0, currency_1.getDecimalPlaces)(amount.currency);
    const divisor = Math.pow(10, decimals);
    return amount.cents / divisor;
}
/**
 * Adds two amounts of the same currency
 * @throws if currencies don't match
 */
function addAmounts(a, b) {
    assertSameCurrency(a, b);
    return amountFromCents(a.cents + b.cents, a.currency);
}
/**
 * Subtracts amount b from amount a
 * @throws if currencies don't match
 */
function subtractAmounts(a, b) {
    assertSameCurrency(a, b);
    return amountFromCents(a.cents - b.cents, a.currency);
}
/**
 * Multiplies an amount by a scalar factor
 */
function multiplyAmount(amount, factor) {
    const newCents = bankersRound(amount.cents * factor);
    return amountFromCents(newCents, amount.currency);
}
/**
 * Sums an array of amounts
 * @throws if currencies don't match or array is empty
 */
function sumAmounts(amounts) {
    if (amounts.length === 0) {
        throw new Error("Cannot sum empty amount array");
    }
    const currency = amounts[0].currency;
    let total = 0;
    for (const amount of amounts) {
        assertSameCurrency(amounts[0], amount);
        total += amount.cents;
    }
    return amountFromCents(total, currency);
}
/**
 * Computes the absolute value of an amount
 */
function absAmount(amount) {
    return amountFromCents(Math.abs(amount.cents), amount.currency);
}
/**
 * Negates an amount
 */
function negateAmount(amount) {
    return amountFromCents(-amount.cents, amount.currency);
}
/**
 * Checks if two amounts are equal
 */
function amountsEqual(a, b) {
    return a.currency === b.currency && a.cents === b.cents;
}
/**
 * Checks if amount is zero
 */
function isZero(amount) {
    return amount.cents === 0;
}
/**
 * Checks if amount is positive (> 0)
 */
function isPositive(amount) {
    return amount.cents > 0;
}
/**
 * Checks if amount is negative (< 0)
 */
function isNegative(amount) {
    return amount.cents < 0;
}
/**
 * Compares two amounts: returns -1, 0, or 1
 * @throws if currencies don't match
 */
function compareAmounts(a, b) {
    assertSameCurrency(a, b);
    if (a.cents < b.cents)
        return -1;
    if (a.cents > b.cents)
        return 1;
    return 0;
}
// ============================================================================
// INTERNAL HELPERS
// ============================================================================
/**
 * Banker's rounding (round half to even) - ensures unbiased rounding
 */
function bankersRound(value) {
    const floor = Math.floor(value);
    const decimal = value - floor;
    if (decimal < 0.5)
        return floor;
    if (decimal > 0.5)
        return floor + 1;
    // Exactly 0.5 - round to even
    return floor % 2 === 0 ? floor : floor + 1;
}
/**
 * Asserts two amounts have the same currency
 */
function assertSameCurrency(a, b) {
    if (a.currency !== b.currency) {
        throw new Error(`Currency mismatch: cannot operate on ${a.currency} and ${b.currency}`);
    }
}
//# sourceMappingURL=amount.js.map