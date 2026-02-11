/**
 * Aggregates - Summary statistics calculation
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Aggregation is deterministic
 * INVARIANT: Same inputs always produce same aggregates
 */

import { Amount, amountFromCents, CurrencyCode } from "../../domain/money";
import { VatLine, sumVatLines, groupVatByRate, calculateVatFromGross } from "../../domain/money/vat";

/**
 * Aggregate statistics for a period
 */
export interface PeriodAggregates {
  readonly transactionCount: number;
  readonly invoiceCount: number;
  readonly matchCount: number;
  readonly totalCredits: Amount;
  readonly totalDebits: Amount;
  readonly netBankFlow: Amount;
  readonly totalInvoiced: Amount;
  readonly averageTransactionAmount: Amount;
  readonly largestTransaction: Amount;
  readonly smallestTransaction: Amount;
}

/**
 * VAT summary for a period
 */
export interface VatSummary {
  readonly totalBase: Amount;
  readonly totalVat: Amount;
  readonly totalGross: Amount;
  readonly byRate: ReadonlyMap<number, VatLine>;
}

/**
 * Calculates aggregate statistics for period
 */
export function calculateAggregates(
  transactionAmounts: readonly number[],
  invoiceAmounts: readonly number[],
  matchedCount: number,
  currency: CurrencyCode
): PeriodAggregates {
  const txCents = transactionAmounts.map((a) => Math.round(a * 100));
  const invCents = invoiceAmounts.map((a) => Math.round(a * 100));

  // Separate credits and debits
  const credits = txCents.filter((c) => c > 0);
  const debits = txCents.filter((c) => c < 0);

  const totalCreditsCents = credits.reduce((sum, c) => sum + c, 0);
  const totalDebitsCents = debits.reduce((sum, c) => sum + c, 0);
  const netFlowCents = totalCreditsCents + totalDebitsCents;

  const totalInvoicedCents = invCents.reduce((sum, c) => sum + c, 0);

  // Calculate average, max, min
  const avgCents = txCents.length > 0 ? Math.round(netFlowCents / txCents.length) : 0;
  const maxCents = txCents.length > 0 ? Math.max(...txCents.map(Math.abs)) : 0;
  const minCents = txCents.length > 0 ? Math.min(...txCents.map(Math.abs)) : 0;

  return {
    transactionCount: transactionAmounts.length,
    invoiceCount: invoiceAmounts.length,
    matchCount: matchedCount,
    totalCredits: amountFromCents(totalCreditsCents, currency),
    totalDebits: amountFromCents(Math.abs(totalDebitsCents), currency),
    netBankFlow: amountFromCents(netFlowCents, currency),
    totalInvoiced: amountFromCents(totalInvoicedCents, currency),
    averageTransactionAmount: amountFromCents(avgCents, currency),
    largestTransaction: amountFromCents(maxCents, currency),
    smallestTransaction: amountFromCents(minCents, currency),
  };
}

/**
 * Calculates VAT summary for invoices
 */
export function calculateVatSummary(
  invoiceData: readonly { totalGross: number; vatRate: number }[],
  currency: CurrencyCode
): VatSummary {
  if (invoiceData.length === 0) {
    return {
      totalBase: amountFromCents(0, currency),
      totalVat: amountFromCents(0, currency),
      totalGross: amountFromCents(0, currency),
      byRate: new Map(),
    };
  }

  const vatLines: VatLine[] = invoiceData.map((inv) => {
    const grossCents = Math.round(inv.totalGross * 100);
    const gross = amountFromCents(grossCents, currency);
    return calculateVatFromGross(gross, inv.vatRate);
  });

  const totals = sumVatLines(vatLines);
  const byRate = groupVatByRate(vatLines);

  return {
    totalBase: totals.totalBase,
    totalVat: totals.totalVat,
    totalGross: totals.totalGross,
    byRate,
  };
}

/**
 * Calculates exception counts
 */
export interface ExceptionCounts {
  readonly totalOpen: number;
  readonly highPriority: number;
  readonly mediumPriority: number;
  readonly lowPriority: number;
}

export function calculateExceptionCounts(
  unmatchedBankCount: number,
  unmatchedInvoiceCount: number,
  ambiguousMatchCount: number,
  lowConfidenceMatchCount: number
): ExceptionCounts {
  // High priority: unmatched with large impact
  const highPriority = Math.min(unmatchedBankCount, unmatchedInvoiceCount);

  // Medium priority: ambiguous matches needing review
  const mediumPriority = ambiguousMatchCount;

  // Low priority: low confidence matches
  const lowPriority = lowConfidenceMatchCount;

  return {
    totalOpen: highPriority + mediumPriority + lowPriority,
    highPriority,
    mediumPriority,
    lowPriority,
  };
}

/**
 * Calculates health score (0-100) based on reconciliation state
 */
export function calculateHealthScore(
  aggregates: PeriodAggregates,
  matchPercentage: number,
  hasOpenHighPriorityExceptions: boolean
): number {
  let score = 100;

  // Deduct for low match percentage
  if (matchPercentage < 100) {
    score -= (100 - matchPercentage) * 0.5;
  }

  // Deduct for unmatched items
  const unmatchedTx = aggregates.transactionCount - aggregates.matchCount;
  const unmatchedInv = aggregates.invoiceCount - aggregates.matchCount;

  if (unmatchedTx > 0) {
    score -= Math.min(20, unmatchedTx * 2);
  }

  if (unmatchedInv > 0) {
    score -= Math.min(20, unmatchedInv * 2);
  }

  // Heavy penalty for high priority exceptions
  if (hasOpenHighPriorityExceptions) {
    score -= 25;
  }

  return Math.max(0, Math.round(score));
}
