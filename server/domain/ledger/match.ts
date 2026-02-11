/**
 * Match domain entity
 * Pure type. No IO, no randomness, no time.
 */

import { Amount, amountsEqual, sumAmounts } from "../money";

/**
 * Match type categories
 */
export const MATCH_TYPES = ["EXACT", "FUZZY", "GROUPED", "PARTIAL", "FEE", "MANUAL"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

/**
 * Match status values
 * NOTE: The canonical status machine is in /state/statusMachine.ts
 *       These are re-exported for convenience when working with Match entities
 */
export type MatchStatus = "PROPOSED" | "CONFIRMED" | "REJECTED";

/**
 * Match entity - represents a proposed or confirmed match between transactions and invoices
 */
export interface Match {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
  readonly matchType: MatchType;
  readonly score: number; // 0-100
  readonly status: MatchStatus;
  readonly explanationKey: string;
  readonly explanationParams: Record<string, string | number>;
  readonly reason?: string;
}

/**
 * Input for creating a Match
 */
export interface MatchInput {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly bankTxIds: readonly string[];
  readonly invoiceIds: readonly string[];
  readonly matchType: MatchType;
  readonly score: number;
  readonly explanationKey: string;
  readonly explanationParams: Record<string, string | number>;
}

/**
 * Creates a Match in PROPOSED status
 * @throws if input is invalid
 */
export function createMatch(input: MatchInput): Match {
  assertNonEmpty(input.id, "id");
  assertNonEmpty(input.tenantId, "tenantId");
  assertNonEmpty(input.monthCloseId, "monthCloseId");
  assertNonEmptyArray(input.bankTxIds, "bankTxIds");
  assertNonEmptyArray(input.invoiceIds, "invoiceIds");
  assertValidScore(input.score);
  assertNonEmpty(input.explanationKey, "explanationKey");

  return {
    id: input.id,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    bankTxIds: [...input.bankTxIds],
    invoiceIds: [...input.invoiceIds],
    matchType: input.matchType,
    score: input.score,
    status: "PROPOSED", // Always starts as PROPOSED
    explanationKey: input.explanationKey,
    explanationParams: { ...input.explanationParams },
  };
}

/**
 * Score thresholds for match quality (for Match entities)
 */
export const MATCH_SCORE_THRESHOLDS = {
  EXACT: 100,
  HIGH_CONFIDENCE: 90,
  MEDIUM_CONFIDENCE: 70,
  LOW_CONFIDENCE: 50,
} as const;

/**
 * Checks if a match entity is high confidence
 */
export function isMatchHighConfidence(match: Match): boolean {
  return match.score >= MATCH_SCORE_THRESHOLDS.HIGH_CONFIDENCE;
}

/**
 * Checks if a match is exact
 */
export function isExactMatch(match: Match): boolean {
  return match.matchType === "EXACT" && match.score === 100;
}

/**
 * Checks if amounts match exactly between transactions and invoices
 */
export function doAmountsMatch(
  txAmounts: readonly Amount[],
  invoiceAmounts: readonly Amount[]
): boolean {
  if (txAmounts.length === 0 || invoiceAmounts.length === 0) {
    return false;
  }

  try {
    const txTotal = sumAmounts(txAmounts);
    const invoiceTotal = sumAmounts(invoiceAmounts);
    return amountsEqual(txTotal, invoiceTotal);
  } catch {
    return false; // Currency mismatch
  }
}

/**
 * Calculates the amount difference between transaction and invoice totals
 */
export function calculateAmountDiff(
  txAmounts: readonly Amount[],
  invoiceAmounts: readonly Amount[]
): Amount | null {
  if (txAmounts.length === 0 || invoiceAmounts.length === 0) {
    return null;
  }

  try {
    const txTotal = sumAmounts(txAmounts);
    const invoiceTotal = sumAmounts(invoiceAmounts);

    if (txTotal.currency !== invoiceTotal.currency) {
      return null;
    }

    return {
      cents: txTotal.cents - invoiceTotal.cents,
      currency: txTotal.currency,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`Match ${field} must not be empty`);
  }
}

function assertNonEmptyArray(arr: readonly string[], field: string): void {
  if (!arr || arr.length === 0) {
    throw new Error(`Match ${field} must not be empty`);
  }
  for (const item of arr) {
    if (!item || item.trim().length === 0) {
      throw new Error(`Match ${field} contains empty values`);
    }
  }
}

function assertValidScore(score: number): void {
  if (score < 0 || score > 100) {
    throw new Error(`Match score must be between 0 and 100, got: ${score}`);
  }
}
