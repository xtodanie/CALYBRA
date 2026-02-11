/**
 * Match Result - Types for matching outcomes
 * Pure types. No IO, no randomness, no time.
 */

import { MatchType } from "../../domain/ledger/match";
import { ScoreBreakdown } from "./scoring";

/**
 * Result status for a match attempt
 */
export const MATCH_RESULT_STATUSES = ["MATCHED", "AMBIGUOUS", "UNMATCHED"] as const;
export type MatchResultStatus = (typeof MATCH_RESULT_STATUSES)[number];

/**
 * A potential match candidate
 */
export interface MatchCandidate {
  readonly bankTxId: string;
  readonly invoiceId: string;
  readonly score: number;
  readonly scoreBreakdown: ScoreBreakdown;
  readonly matchType: MatchType;
}

/**
 * Result of attempting to match a transaction
 */
export interface MatchResult {
  readonly status: MatchResultStatus;
  readonly bankTxId: string;
  readonly confidence: number; // 0-100, highest candidate score
  readonly candidates: readonly MatchCandidate[];
  readonly explanation: string;
}

/**
 * Thresholds for match classification
 */
export const MATCH_THRESHOLDS = {
  /** Minimum score to be considered a match */
  MIN_MATCH: 50,
  /** Minimum score for high confidence */
  HIGH_CONFIDENCE: 85,
  /** Minimum score for auto-confirm eligibility */
  AUTO_CONFIRM: 95,
  /** Maximum score difference between top candidates to be ambiguous */
  AMBIGUITY_DELTA: 10,
} as const;

/**
 * Creates a MATCHED result
 */
export function matchedResult(
  bankTxId: string,
  candidate: MatchCandidate,
  explanation: string
): MatchResult {
  return {
    status: "MATCHED",
    bankTxId,
    confidence: candidate.score,
    candidates: [candidate],
    explanation,
  };
}

/**
 * Creates an AMBIGUOUS result with multiple candidates
 */
export function ambiguousResult(
  bankTxId: string,
  candidates: readonly MatchCandidate[],
  explanation: string
): MatchResult {
  const topScore = candidates.length > 0 ? Math.max(...candidates.map((c) => c.score)) : 0;

  return {
    status: "AMBIGUOUS",
    bankTxId,
    confidence: topScore,
    candidates,
    explanation,
  };
}

/**
 * Creates an UNMATCHED result
 */
export function unmatchedResult(
  bankTxId: string,
  explanation: string
): MatchResult {
  return {
    status: "UNMATCHED",
    bankTxId,
    confidence: 0,
    candidates: [],
    explanation,
  };
}

/**
 * Checks if a match result qualifies for auto-confirmation
 */
export function canAutoConfirm(result: MatchResult): boolean {
  if (result.status !== "MATCHED") {
    return false;
  }

  if (result.candidates.length !== 1) {
    return false;
  }

  return result.confidence >= MATCH_THRESHOLDS.AUTO_CONFIRM;
}

/**
 * Checks if a match result is high confidence
 */
export function isHighConfidence(result: MatchResult): boolean {
  return result.confidence >= MATCH_THRESHOLDS.HIGH_CONFIDENCE;
}

/**
 * Determines match type based on matching characteristics
 */
export function determineMatchType(
  txIds: readonly string[],
  invoiceIds: readonly string[],
  isExactAmount: boolean,
  isManual: boolean
): MatchType {
  if (isManual) {
    return "MANUAL";
  }

  if (txIds.length === 1 && invoiceIds.length === 1) {
    return isExactAmount ? "EXACT" : "FUZZY";
  }

  if (txIds.length > 1 || invoiceIds.length > 1) {
    return "GROUPED";
  }

  return "FUZZY";
}
