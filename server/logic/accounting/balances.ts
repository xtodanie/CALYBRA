/**
 * Balances - Balance calculation logic
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Balance calculations are deterministic
 * INVARIANT: Same inputs always produce same balances
 */

import { Amount, amountFromCents, subtractAmounts, CurrencyCode } from "../../domain/money";

/**
 * Balance sheet for a period
 */
export interface PeriodBalance {
  readonly currency: CurrencyCode;
  readonly bankTotal: Amount;
  readonly invoiceTotal: Amount;
  readonly difference: Amount;
  readonly matchedBankTotal: Amount;
  readonly matchedInvoiceTotal: Amount;
  readonly unmatchedBankTotal: Amount;
  readonly unmatchedInvoiceTotal: Amount;
  readonly matchedCount: number;
  readonly unmatchedBankCount: number;
  readonly unmatchedInvoiceCount: number;
}

/**
 * Input for balance calculation
 */
export interface BalanceInput {
  readonly currency: CurrencyCode;
  readonly bankTxAmounts: readonly number[];
  readonly invoiceAmounts: readonly number[];
  readonly matchedBankTxAmounts: readonly number[];
  readonly matchedInvoiceAmounts: readonly number[];
}

/**
 * Calculates period balances
 *
 * @param input - Balance calculation input
 * @returns PeriodBalance with all calculated values
 */
export function calculatePeriodBalance(input: BalanceInput): PeriodBalance {
  const { currency } = input;

  // Convert to cents for accurate math
  const bankAmounts = input.bankTxAmounts.map((a) => decimalToCents(a));
  const invoiceAmounts = input.invoiceAmounts.map((a) => decimalToCents(a));
  const matchedBankAmounts = input.matchedBankTxAmounts.map((a) => decimalToCents(a));
  const matchedInvoiceAmounts = input.matchedInvoiceAmounts.map((a) => decimalToCents(a));

  // Calculate totals
  const bankTotal = sumCents(bankAmounts, currency);
  const invoiceTotal = sumCents(invoiceAmounts, currency);
  const difference = subtractAmounts(bankTotal, invoiceTotal);

  const matchedBankTotal = sumCents(matchedBankAmounts, currency);
  const matchedInvoiceTotal = sumCents(matchedInvoiceAmounts, currency);

  // Calculate unmatched totals
  const unmatchedBankCents = bankTotal.cents - matchedBankTotal.cents;
  const unmatchedInvoiceCents = invoiceTotal.cents - matchedInvoiceTotal.cents;

  const unmatchedBankTotal = amountFromCents(unmatchedBankCents, currency);
  const unmatchedInvoiceTotal = amountFromCents(unmatchedInvoiceCents, currency);

  // Calculate counts
  const matchedCount = Math.min(matchedBankAmounts.length, matchedInvoiceAmounts.length);
  const unmatchedBankCount = bankAmounts.length - matchedBankAmounts.length;
  const unmatchedInvoiceCount = invoiceAmounts.length - matchedInvoiceAmounts.length;

  return {
    currency,
    bankTotal,
    invoiceTotal,
    difference,
    matchedBankTotal,
    matchedInvoiceTotal,
    unmatchedBankTotal,
    unmatchedInvoiceTotal,
    matchedCount,
    unmatchedBankCount: Math.max(0, unmatchedBankCount),
    unmatchedInvoiceCount: Math.max(0, unmatchedInvoiceCount),
  };
}

/**
 * Checks if balances are reconciled (difference is zero)
 */
export function isReconciled(balance: PeriodBalance): boolean {
  return balance.difference.cents === 0;
}

/**
 * Checks if balances are within tolerance
 */
export function isWithinTolerance(balance: PeriodBalance, toleranceCents: number): boolean {
  return Math.abs(balance.difference.cents) <= toleranceCents;
}

/**
 * Calculates reconciliation percentage
 */
export function getReconciliationPercent(balance: PeriodBalance): number {
  const totalItems = balance.matchedCount + balance.unmatchedBankCount + balance.unmatchedInvoiceCount;

  if (totalItems === 0) {
    return 100; // No items = fully reconciled
  }

  return Math.round((balance.matchedCount / totalItems) * 100);
}

// ============================================================================
// HELPERS
// ============================================================================

function decimalToCents(decimal: number): number {
  // Assuming 2 decimal places for all supported currencies
  return Math.round(decimal * 100);
}

function sumCents(cents: readonly number[], currency: CurrencyCode): Amount {
  if (cents.length === 0) {
    return amountFromCents(0, currency);
  }

  let total = 0;
  for (const c of cents) {
    total += c;
  }
  return amountFromCents(total, currency);
}
