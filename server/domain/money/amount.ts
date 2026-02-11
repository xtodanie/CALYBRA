/**
 * Amount value object - monetary amounts with deterministic math
 * Pure type + math. No IO, no randomness, no time.
 *
 * INVARIANT: All monetary calculations use integer arithmetic (cents)
 * to avoid floating-point precision issues.
 */

import { CurrencyCode, getDecimalPlaces } from "./currency";

/**
 * Monetary amount represented as an integer in the smallest currency unit (cents)
 */
export interface Amount {
  readonly cents: number; // Integer in smallest currency unit
  readonly currency: CurrencyCode;
}

/**
 * Creates an Amount from cents (integer)
 * @throws if cents is not a safe integer
 */
export function amountFromCents(cents: number, currency: CurrencyCode): Amount {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Amount cents must be a safe integer, got: ${cents}`);
  }
  return { cents, currency };
}

/**
 * Creates an Amount from a decimal value (e.g., 123.45 EUR)
 * Rounds to the nearest cent using banker's rounding (round half to even)
 */
export function amountFromDecimal(value: number, currency: CurrencyCode): Amount {
  const decimals = getDecimalPlaces(currency);
  const multiplier = Math.pow(10, decimals);
  const cents = bankersRound(value * multiplier);
  return amountFromCents(cents, currency);
}

/**
 * Converts an Amount to its decimal representation
 */
export function amountToDecimal(amount: Amount): number {
  const decimals = getDecimalPlaces(amount.currency);
  const divisor = Math.pow(10, decimals);
  return amount.cents / divisor;
}

/**
 * Adds two amounts of the same currency
 * @throws if currencies don't match
 */
export function addAmounts(a: Amount, b: Amount): Amount {
  assertSameCurrency(a, b);
  return amountFromCents(a.cents + b.cents, a.currency);
}

/**
 * Subtracts amount b from amount a
 * @throws if currencies don't match
 */
export function subtractAmounts(a: Amount, b: Amount): Amount {
  assertSameCurrency(a, b);
  return amountFromCents(a.cents - b.cents, a.currency);
}

/**
 * Multiplies an amount by a scalar factor
 */
export function multiplyAmount(amount: Amount, factor: number): Amount {
  const newCents = bankersRound(amount.cents * factor);
  return amountFromCents(newCents, amount.currency);
}

/**
 * Sums an array of amounts
 * @throws if currencies don't match or array is empty
 */
export function sumAmounts(amounts: readonly Amount[]): Amount {
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
export function absAmount(amount: Amount): Amount {
  return amountFromCents(Math.abs(amount.cents), amount.currency);
}

/**
 * Negates an amount
 */
export function negateAmount(amount: Amount): Amount {
  return amountFromCents(-amount.cents, amount.currency);
}

/**
 * Checks if two amounts are equal
 */
export function amountsEqual(a: Amount, b: Amount): boolean {
  return a.currency === b.currency && a.cents === b.cents;
}

/**
 * Checks if amount is zero
 */
export function isZero(amount: Amount): boolean {
  return amount.cents === 0;
}

/**
 * Checks if amount is positive (> 0)
 */
export function isPositive(amount: Amount): boolean {
  return amount.cents > 0;
}

/**
 * Checks if amount is negative (< 0)
 */
export function isNegative(amount: Amount): boolean {
  return amount.cents < 0;
}

/**
 * Compares two amounts: returns -1, 0, or 1
 * @throws if currencies don't match
 */
export function compareAmounts(a: Amount, b: Amount): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  if (a.cents < b.cents) return -1;
  if (a.cents > b.cents) return 1;
  return 0;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Banker's rounding (round half to even) - ensures unbiased rounding
 */
function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;

  if (decimal < 0.5) return floor;
  if (decimal > 0.5) return floor + 1;

  // Exactly 0.5 - round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

/**
 * Asserts two amounts have the same currency
 */
function assertSameCurrency(a: Amount, b: Amount): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `Currency mismatch: cannot operate on ${a.currency} and ${b.currency}`
    );
  }
}
