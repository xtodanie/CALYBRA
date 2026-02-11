/**
 * Match Scoring - Confidence calculation for matches
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Scoring is deterministic
 * INVARIANT: Same inputs always produce same scores
 */

import { Amount, amountsEqual, absAmount } from "../../domain/money";

/**
 * Score weights for different matching criteria
 */
export const SCORE_WEIGHTS = {
  AMOUNT_EXACT: 40,
  AMOUNT_CLOSE: 25,
  DATE_MATCH: 20,
  DATE_CLOSE: 10,
  REFERENCE_MATCH: 20,
  COUNTERPARTY_MATCH: 15,
  DESCRIPTION_SIMILARITY: 5,
} as const;

/**
 * Tolerance thresholds
 */
export const TOLERANCES = {
  /** Maximum days difference for date to be considered "close" */
  DATE_DAYS: 3,
  /** Maximum percentage difference for amount to be considered "close" */
  AMOUNT_PERCENT: 1,
} as const;

/**
 * Match scoring input
 */
export interface ScoringInput {
  readonly txAmount: Amount;
  readonly invoiceAmount: Amount;
  readonly txDate: string;
  readonly invoiceDate: string;
  readonly txDescription: string;
  readonly invoiceSupplier: string;
  readonly txReference?: string;
  readonly invoiceNumber?: string;
  readonly txCounterparty?: string;
}

/**
 * Detailed score breakdown
 */
export interface ScoreBreakdown {
  readonly total: number; // 0-100
  readonly amountScore: number;
  readonly dateScore: number;
  readonly referenceScore: number;
  readonly counterpartyScore: number;
  readonly descriptionScore: number;
  readonly explanation: string;
}

/**
 * Calculates match score between a transaction and invoice
 *
 * @param input - The scoring input with transaction and invoice data
 * @returns Score breakdown with total and component scores
 */
export function calculateMatchScore(input: ScoringInput): ScoreBreakdown {
  const amountScore = scoreAmount(input.txAmount, input.invoiceAmount);
  const dateScore = scoreDate(input.txDate, input.invoiceDate);
  const referenceScore = scoreReference(input.txReference, input.invoiceNumber);
  const counterpartyScore = scoreCounterparty(input.txCounterparty, input.invoiceSupplier);
  const descriptionScore = scoreDescription(input.txDescription, input.invoiceSupplier);

  const total = Math.min(
    100,
    amountScore + dateScore + referenceScore + counterpartyScore + descriptionScore
  );

  const explanation = buildExplanation({
    amountScore,
    dateScore,
    referenceScore,
    counterpartyScore,
    descriptionScore,
    total,
  });

  return {
    total,
    amountScore,
    dateScore,
    referenceScore,
    counterpartyScore,
    descriptionScore,
    explanation,
  };
}

/**
 * Scores amount match
 */
function scoreAmount(txAmount: Amount, invoiceAmount: Amount): number {
  if (txAmount.currency !== invoiceAmount.currency) {
    return 0;
  }

  // Exact match (comparing absolute values for debit/credit handling)
  const txAbs = absAmount(txAmount);
  const invAbs = absAmount(invoiceAmount);

  if (amountsEqual(txAbs, invAbs)) {
    return SCORE_WEIGHTS.AMOUNT_EXACT;
  }

  // Close match - within tolerance
  const diff = Math.abs(txAbs.cents - invAbs.cents);
  const maxAmount = Math.max(txAbs.cents, invAbs.cents);

  if (maxAmount > 0) {
    const percentDiff = (diff / maxAmount) * 100;
    if (percentDiff <= TOLERANCES.AMOUNT_PERCENT) {
      return SCORE_WEIGHTS.AMOUNT_CLOSE;
    }
  }

  return 0;
}

/**
 * Scores date match
 */
function scoreDate(txDate: string, invoiceDate: string): number {
  const txDays = dateToDays(txDate);
  const invDays = dateToDays(invoiceDate);

  if (txDays === null || invDays === null) {
    return 0;
  }

  const diff = Math.abs(txDays - invDays);

  if (diff === 0) {
    return SCORE_WEIGHTS.DATE_MATCH;
  }

  if (diff <= TOLERANCES.DATE_DAYS) {
    return SCORE_WEIGHTS.DATE_CLOSE;
  }

  return 0;
}

/**
 * Scores reference/invoice number match
 */
function scoreReference(txReference?: string, invoiceNumber?: string): number {
  if (!txReference || !invoiceNumber) {
    return 0;
  }

  const txRef = normalizeReference(txReference);
  const invRef = normalizeReference(invoiceNumber);

  if (txRef.length === 0 || invRef.length === 0) {
    return 0;
  }

  // Exact match
  if (txRef === invRef) {
    return SCORE_WEIGHTS.REFERENCE_MATCH;
  }

  // Partial match - one contains the other
  if (txRef.includes(invRef) || invRef.includes(txRef)) {
    return Math.floor(SCORE_WEIGHTS.REFERENCE_MATCH * 0.7);
  }

  return 0;
}

/**
 * Scores counterparty/supplier match
 */
function scoreCounterparty(txCounterparty?: string, invoiceSupplier?: string): number {
  if (!txCounterparty || !invoiceSupplier) {
    return 0;
  }

  const txName = normalizeName(txCounterparty);
  const invName = normalizeName(invoiceSupplier);

  if (txName.length === 0 || invName.length === 0) {
    return 0;
  }

  // Exact match
  if (txName === invName) {
    return SCORE_WEIGHTS.COUNTERPARTY_MATCH;
  }

  // Partial match - significant overlap
  const similarity = calculateSimilarity(txName, invName);
  if (similarity >= 0.7) {
    return Math.floor(SCORE_WEIGHTS.COUNTERPARTY_MATCH * similarity);
  }

  return 0;
}

/**
 * Scores description similarity to supplier name
 */
function scoreDescription(txDescription: string, invoiceSupplier: string): number {
  const desc = normalizeName(txDescription);
  const supplier = normalizeName(invoiceSupplier);

  if (desc.length === 0 || supplier.length === 0) {
    return 0;
  }

  // Check if supplier name appears in description
  if (desc.includes(supplier)) {
    return SCORE_WEIGHTS.DESCRIPTION_SIMILARITY;
  }

  // Check word overlap
  const descWords = desc.split(/\s+/);
  const supplierWords = supplier.split(/\s+/);

  let matches = 0;
  for (const word of supplierWords) {
    if (word.length >= 3 && descWords.some((w) => w.includes(word) || word.includes(w))) {
      matches++;
    }
  }

  if (matches > 0 && supplierWords.length > 0) {
    const overlapRatio = matches / supplierWords.length;
    if (overlapRatio >= 0.5) {
      return Math.floor(SCORE_WEIGHTS.DESCRIPTION_SIMILARITY * overlapRatio);
    }
  }

  return 0;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Converts YYYY-MM-DD to day number for comparison
 */
function dateToDays(dateStr: string): number | null {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Simple days calculation (good enough for diff)
  return year * 365 + month * 30 + day;
}

/**
 * Normalizes a reference string for comparison
 */
function normalizeReference(ref: string): string {
  return ref
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim();
}

/**
 * Normalizes a name for comparison
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates string similarity (Jaccard-like)
 */
function calculateSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/));
  const setB = new Set(b.split(/\s+/));

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Builds human-readable explanation of score
 */
function buildExplanation(scores: {
  amountScore: number;
  dateScore: number;
  referenceScore: number;
  counterpartyScore: number;
  descriptionScore: number;
  total: number;
}): string {
  const parts: string[] = [];

  if (scores.amountScore === SCORE_WEIGHTS.AMOUNT_EXACT) {
    parts.push("exact amount match");
  } else if (scores.amountScore === SCORE_WEIGHTS.AMOUNT_CLOSE) {
    parts.push("close amount match");
  }

  if (scores.dateScore === SCORE_WEIGHTS.DATE_MATCH) {
    parts.push("same date");
  } else if (scores.dateScore === SCORE_WEIGHTS.DATE_CLOSE) {
    parts.push("close date");
  }

  if (scores.referenceScore > 0) {
    parts.push("reference match");
  }

  if (scores.counterpartyScore > 0) {
    parts.push("counterparty match");
  }

  if (scores.descriptionScore > 0) {
    parts.push("description similarity");
  }

  if (parts.length === 0) {
    return "no significant matches";
  }

  return parts.join(", ");
}
