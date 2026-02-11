/**
 * Compute Month Close - Main month close calculation
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: MonthClose calculation is deterministic
 * INVARIANT: MonthClose is a RESULT, not a source of truth
 * INVARIANT: Must be deletable and rebuildable to the same output
 */

import { CurrencyCode } from "../../domain/money";
import { calculatePeriodBalance, PeriodBalance, BalanceInput } from "./balances";
import { calculateAggregates, calculateExceptionCounts, PeriodAggregates, ExceptionCounts } from "./aggregates";
import { generateReconciliationReport, ReconciliationReport, ReconciliationConfig, DEFAULT_RECONCILIATION_CONFIG } from "./reconciliation";

/**
 * Input for computing a month close
 */
export interface MonthCloseInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly periodStart: string; // YYYY-MM-DD
  readonly periodEnd: string; // YYYY-MM-DD
  readonly currency: CurrencyCode;

  /** All bank transaction amounts for the period */
  readonly bankTxAmounts: readonly number[];

  /** All invoice amounts for the period */
  readonly invoiceAmounts: readonly number[];

  /** Matched bank transaction amounts */
  readonly matchedBankTxAmounts: readonly number[];

  /** Matched invoice amounts */
  readonly matchedInvoiceAmounts: readonly number[];

  /** Number of matches in PROPOSED status */
  readonly proposedMatchCount: number;

  /** Number of matches in CONFIRMED status */
  readonly confirmedMatchCount: number;

  /** Number of matches with score < 70 */
  readonly lowConfidenceMatchCount: number;

  /** Number of matches in AMBIGUOUS state */
  readonly ambiguousMatchCount: number;
}

/**
 * Computed month close result
 */
export interface MonthCloseResult {
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: CurrencyCode;

  /** Summary numbers for storage */
  readonly bankTotal: number;
  readonly invoiceTotal: number;
  readonly diff: number;
  readonly openExceptionsCount: number;
  readonly highExceptionsCount: number;

  /** Detailed breakdown */
  readonly balance: PeriodBalance;
  readonly aggregates: PeriodAggregates;
  readonly exceptions: ExceptionCounts;
  readonly reconciliation: ReconciliationReport;

  /** Computed flags */
  readonly canTransitionToReview: boolean;
  readonly canFinalize: boolean;
  readonly blockingIssues: readonly string[];
}

/**
 * Computes a month close from input data
 *
 * @param input - All data needed to compute the month close
 * @param config - Optional reconciliation configuration
 * @returns MonthCloseResult with all computed values
 */
export function computeMonthClose(
  input: MonthCloseInput,
  config: ReconciliationConfig = DEFAULT_RECONCILIATION_CONFIG
): MonthCloseResult {
  // Calculate balances
  const balanceInput: BalanceInput = {
    currency: input.currency,
    bankTxAmounts: input.bankTxAmounts,
    invoiceAmounts: input.invoiceAmounts,
    matchedBankTxAmounts: input.matchedBankTxAmounts,
    matchedInvoiceAmounts: input.matchedInvoiceAmounts,
  };

  const balance = calculatePeriodBalance(balanceInput);

  // Calculate aggregates
  const aggregates = calculateAggregates(
    input.bankTxAmounts,
    input.invoiceAmounts,
    input.confirmedMatchCount,
    input.currency
  );

  // Calculate exceptions
  const exceptions = calculateExceptionCounts(
    balance.unmatchedBankCount,
    balance.unmatchedInvoiceCount,
    input.ambiguousMatchCount,
    input.lowConfidenceMatchCount
  );

  // Generate reconciliation report
  const reconciliation = generateReconciliationReport(balance, aggregates, exceptions, config);

  // Convert to storage format
  const bankTotal = balance.bankTotal.cents / 100;
  const invoiceTotal = balance.invoiceTotal.cents / 100;
  const diff = balance.difference.cents / 100;

  return {
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    currency: input.currency,

    // Storage fields
    bankTotal,
    invoiceTotal,
    diff,
    openExceptionsCount: exceptions.totalOpen,
    highExceptionsCount: exceptions.highPriority,

    // Detailed breakdown
    balance,
    aggregates,
    exceptions,
    reconciliation,

    // Computed flags
    canTransitionToReview: reconciliation.matchPercentage >= 50,
    canFinalize: reconciliation.readyToFinalize,
    blockingIssues: reconciliation.blockingIssues,
  };
}

/**
 * Validates that a month close can be recomputed to the same values
 *
 * @param stored - The stored month close values
 * @param computed - The freshly computed values
 * @returns Validation result
 */
export function validateRecomputability(
  stored: { bankTotal: number; invoiceTotal: number; diff: number },
  computed: MonthCloseResult
): { valid: boolean; discrepancies: string[] } {
  const discrepancies: string[] = [];

  // Allow small floating point differences (1 cent)
  const tolerance = 0.01;

  if (Math.abs(stored.bankTotal - computed.bankTotal) > tolerance) {
    discrepancies.push(
      `bankTotal mismatch: stored=${stored.bankTotal}, computed=${computed.bankTotal}`
    );
  }

  if (Math.abs(stored.invoiceTotal - computed.invoiceTotal) > tolerance) {
    discrepancies.push(
      `invoiceTotal mismatch: stored=${stored.invoiceTotal}, computed=${computed.invoiceTotal}`
    );
  }

  if (Math.abs(stored.diff - computed.diff) > tolerance) {
    discrepancies.push(
      `diff mismatch: stored=${stored.diff}, computed=${computed.diff}`
    );
  }

  return {
    valid: discrepancies.length === 0,
    discrepancies,
  };
}

/**
 * Creates empty month close result for a new period
 */
export function createEmptyMonthCloseResult(
  tenantId: string,
  monthCloseId: string,
  periodStart: string,
  periodEnd: string,
  currency: CurrencyCode
): MonthCloseResult {
  return computeMonthClose({
    tenantId,
    monthCloseId,
    periodStart,
    periodEnd,
    currency,
    bankTxAmounts: [],
    invoiceAmounts: [],
    matchedBankTxAmounts: [],
    matchedInvoiceAmounts: [],
    proposedMatchCount: 0,
    confirmedMatchCount: 0,
    lowConfidenceMatchCount: 0,
    ambiguousMatchCount: 0,
  });
}
