/**
 * Reconciliation - Reconciliation status and checks
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Reconciliation checks are deterministic
 * INVARIANT: Same inputs always produce same results
 */

import { Amount, amountFromCents } from "../../domain/money";
import { PeriodBalance } from "./balances";
import { PeriodAggregates, ExceptionCounts } from "./aggregates";

/**
 * Reconciliation status values
 */
export const RECONCILIATION_STATUSES = ["COMPLETE", "PARTIAL", "PENDING", "NEEDS_REVIEW"] as const;
export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

/**
 * Full reconciliation report
 */
export interface ReconciliationReport {
  readonly status: ReconciliationStatus;
  readonly balance: PeriodBalance;
  readonly aggregates: PeriodAggregates;
  readonly exceptions: ExceptionCounts;
  readonly matchPercentage: number;
  readonly isBalanced: boolean;
  readonly toleranceExceeded: boolean;
  readonly readyToFinalize: boolean;
  readonly blockingIssues: readonly string[];
}

/**
 * Configuration for reconciliation checks
 */
export interface ReconciliationConfig {
  /** Maximum allowed difference in cents */
  readonly toleranceCents: number;
  /** Minimum match percentage to proceed */
  readonly minMatchPercentage: number;
  /** Whether high priority exceptions block finalization */
  readonly blockOnHighPriority: boolean;
}

/**
 * Default reconciliation configuration
 */
export const DEFAULT_RECONCILIATION_CONFIG: ReconciliationConfig = {
  toleranceCents: 100, // 1.00 in base currency unit
  minMatchPercentage: 90,
  blockOnHighPriority: true,
} as const;

/**
 * Generates a reconciliation report
 */
export function generateReconciliationReport(
  balance: PeriodBalance,
  aggregates: PeriodAggregates,
  exceptions: ExceptionCounts,
  config: ReconciliationConfig = DEFAULT_RECONCILIATION_CONFIG
): ReconciliationReport {
  const matchPercentage = calculateMatchPercentage(aggregates);
  const isBalanced = Math.abs(balance.difference.cents) <= config.toleranceCents;
  const toleranceExceeded = Math.abs(balance.difference.cents) > config.toleranceCents;

  const blockingIssues = identifyBlockingIssues(
    balance,
    exceptions,
    matchPercentage,
    config
  );

  const readyToFinalize = blockingIssues.length === 0;
  const status = determineStatus(matchPercentage, isBalanced, exceptions, readyToFinalize);

  return {
    status,
    balance,
    aggregates,
    exceptions,
    matchPercentage,
    isBalanced,
    toleranceExceeded,
    readyToFinalize,
    blockingIssues,
  };
}

/**
 * Calculates match percentage
 */
function calculateMatchPercentage(aggregates: PeriodAggregates): number {
  const totalItems = aggregates.transactionCount + aggregates.invoiceCount;

  if (totalItems === 0) {
    return 100;
  }

  // Each match covers one tx and one invoice
  const matchedItems = aggregates.matchCount * 2;
  return Math.round((matchedItems / totalItems) * 100);
}

/**
 * Identifies issues blocking finalization
 */
function identifyBlockingIssues(
  balance: PeriodBalance,
  exceptions: ExceptionCounts,
  matchPercentage: number,
  config: ReconciliationConfig
): string[] {
  const issues: string[] = [];

  if (Math.abs(balance.difference.cents) > config.toleranceCents) {
    const diffDisplay = (balance.difference.cents / 100).toFixed(2);
    issues.push(`Balance difference (${diffDisplay}) exceeds tolerance`);
  }

  if (matchPercentage < config.minMatchPercentage) {
    issues.push(`Match percentage (${matchPercentage}%) below minimum (${config.minMatchPercentage}%)`);
  }

  if (config.blockOnHighPriority && exceptions.highPriority > 0) {
    issues.push(`${exceptions.highPriority} high priority exception(s) unresolved`);
  }

  if (balance.unmatchedBankCount > 0) {
    issues.push(`${balance.unmatchedBankCount} unmatched bank transaction(s)`);
  }

  if (balance.unmatchedInvoiceCount > 0) {
    issues.push(`${balance.unmatchedInvoiceCount} unmatched invoice(s)`);
  }

  return issues;
}

/**
 * Determines reconciliation status
 */
function determineStatus(
  matchPercentage: number,
  isBalanced: boolean,
  exceptions: ExceptionCounts,
  readyToFinalize: boolean
): ReconciliationStatus {
  if (readyToFinalize && matchPercentage === 100 && isBalanced) {
    return "COMPLETE";
  }

  if (matchPercentage >= 50 && !exceptions.highPriority) {
    return "PARTIAL";
  }

  if (exceptions.highPriority > 0 || exceptions.totalOpen > 5) {
    return "NEEDS_REVIEW";
  }

  return "PENDING";
}

/**
 * Checks if a period can be transitioned to IN_REVIEW
 */
export function canTransitionToReview(report: ReconciliationReport): {
  allowed: boolean;
  reason: string;
} {
  if (report.matchPercentage < 50) {
    return {
      allowed: false,
      reason: `Match percentage too low (${report.matchPercentage}%). Minimum 50% required for review.`,
    };
  }

  return { allowed: true, reason: "Period ready for review" };
}

/**
 * Checks if a period can be finalized
 */
export function canFinalize(report: ReconciliationReport): {
  allowed: boolean;
  reason: string;
} {
  if (!report.readyToFinalize) {
    return {
      allowed: false,
      reason: `Cannot finalize: ${report.blockingIssues.join("; ")}`,
    };
  }

  return { allowed: true, reason: "Period ready for finalization" };
}

/**
 * Calculates the discrepancy breakdown
 */
export interface DiscrepancyBreakdown {
  readonly totalDiscrepancy: Amount;
  readonly fromUnmatchedBank: Amount;
  readonly fromUnmatchedInvoice: Amount;
  readonly unexplained: Amount;
}

export function calculateDiscrepancyBreakdown(
  balance: PeriodBalance
): DiscrepancyBreakdown {
  const unmatchedBankCents = balance.unmatchedBankTotal.cents;
  const unmatchedInvoiceCents = balance.unmatchedInvoiceTotal.cents;
  const totalDiffCents = balance.difference.cents;

  // Unexplained = total diff - (unmatched bank - unmatched invoice)
  const explainedDiffCents = unmatchedBankCents - unmatchedInvoiceCents;
  const unexplainedCents = totalDiffCents - explainedDiffCents;

  return {
    totalDiscrepancy: balance.difference,
    fromUnmatchedBank: balance.unmatchedBankTotal,
    fromUnmatchedInvoice: balance.unmatchedInvoiceTotal,
    unexplained: amountFromCents(unexplainedCents, balance.currency),
  };
}
