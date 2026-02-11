/**
 * Match Invoice to Transaction - Core matching logic
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Matching NEVER finalizes
 * INVARIANT: Matching NEVER writes truth
 * INVARIANT: Matching can be rerun infinitely
 * INVARIANT: Same inputs always produce same outputs
 */

import { amountFromDecimal, CurrencyCode, amountsEqual, absAmount } from "../../domain/money";
import { calculateMatchScore, ScoringInput, ScoreBreakdown } from "./scoring";
import {
  MatchResult,
  MatchCandidate,
  MATCH_THRESHOLDS,
  matchedResult,
  ambiguousResult,
  unmatchedResult,
  determineMatchType,
} from "./matchResult";

// Re-export MatchResult for convenience
export type { MatchResult, MatchCandidate } from "./matchResult";

/**
 * Transaction data for matching
 */
export interface TxForMatching {
  readonly id: string;
  readonly bookingDate: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly counterparty?: string;
  readonly reference?: string;
}

/**
 * Invoice data for matching
 */
export interface InvoiceForMatching {
  readonly id: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly currency: CurrencyCode;
  readonly supplierName: string;
  readonly invoiceNumber: string;
}

/**
 * Already matched IDs to exclude
 */
export interface ExclusionSet {
  readonly matchedTxIds: ReadonlySet<string>;
  readonly matchedInvoiceIds: ReadonlySet<string>;
}

/**
 * Matches a single transaction against all available invoices
 *
 * @param tx - The transaction to match
 * @param invoices - All available invoices for the period
 * @param exclusions - Already matched IDs to exclude
 * @returns MatchResult with status and candidates
 */
export function matchTransactionToInvoices(
  tx: TxForMatching,
  invoices: readonly InvoiceForMatching[],
  exclusions: ExclusionSet
): MatchResult {
  // Skip already matched transactions
  if (exclusions.matchedTxIds.has(tx.id)) {
    return unmatchedResult(tx.id, "Transaction already matched");
  }

  // Filter out already matched invoices
  const availableInvoices = invoices.filter(
    (inv) => !exclusions.matchedInvoiceIds.has(inv.id)
  );

  if (availableInvoices.length === 0) {
    return unmatchedResult(tx.id, "No available invoices to match");
  }

  // Calculate scores for all available invoices
  const candidates: MatchCandidate[] = [];

  for (const invoice of availableInvoices) {
    const scoreBreakdown = scoreMatch(tx, invoice);

    if (scoreBreakdown.total >= MATCH_THRESHOLDS.MIN_MATCH) {
      const txAmount = amountFromDecimal(tx.amount, tx.currency);
      const invAmount = amountFromDecimal(invoice.totalGross, invoice.currency);
      const isExactAmount = amountsEqual(absAmount(txAmount), absAmount(invAmount));

      candidates.push({
        bankTxId: tx.id,
        invoiceId: invoice.id,
        score: scoreBreakdown.total,
        scoreBreakdown,
        matchType: determineMatchType([tx.id], [invoice.id], isExactAmount, false),
      });
    }
  }

  // No candidates above threshold
  if (candidates.length === 0) {
    return unmatchedResult(tx.id, "No invoices matched above threshold");
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Single candidate
  if (candidates.length === 1) {
    return matchedResult(
      tx.id,
      candidates[0],
      `Matched with confidence ${candidates[0].score}%`
    );
  }

  // Check for ambiguity - top candidates too close in score
  const topScore = candidates[0].score;
  const ambiguousCandidates = candidates.filter(
    (c) => topScore - c.score <= MATCH_THRESHOLDS.AMBIGUITY_DELTA
  );

  if (ambiguousCandidates.length > 1) {
    return ambiguousResult(
      tx.id,
      ambiguousCandidates,
      `${ambiguousCandidates.length} candidates within ${MATCH_THRESHOLDS.AMBIGUITY_DELTA}% of top score`
    );
  }

  // Clear winner
  return matchedResult(
    tx.id,
    candidates[0],
    `Matched with confidence ${candidates[0].score}%`
  );
}

/**
 * Matches all transactions against all invoices
 *
 * @param transactions - All transactions to match
 * @param invoices - All available invoices
 * @param exclusions - Already matched IDs to exclude
 * @returns Array of MatchResults for each transaction
 */
export function matchAllTransactions(
  transactions: readonly TxForMatching[],
  invoices: readonly InvoiceForMatching[],
  exclusions: ExclusionSet
): MatchResult[] {
  const results: MatchResult[] = [];

  // Track newly matched IDs during this run
  const newlyMatchedTxIds = new Set<string>(exclusions.matchedTxIds);
  const newlyMatchedInvoiceIds = new Set<string>(exclusions.matchedInvoiceIds);

  // Sort transactions by amount (larger first for better matching)
  const sortedTx = [...transactions].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );

  for (const tx of sortedTx) {
    const currentExclusions: ExclusionSet = {
      matchedTxIds: newlyMatchedTxIds,
      matchedInvoiceIds: newlyMatchedInvoiceIds,
    };

    const result = matchTransactionToInvoices(tx, invoices, currentExclusions);
    results.push(result);

    // If matched, add to exclusions for subsequent iterations
    if (result.status === "MATCHED" && result.candidates.length === 1) {
      newlyMatchedTxIds.add(tx.id);
      newlyMatchedInvoiceIds.add(result.candidates[0].invoiceId);
    }
  }

  return results;
}

/**
 * Attempts grouped matching for multiple transactions to one invoice
 */
export function tryGroupedMatch(
  transactions: readonly TxForMatching[],
  invoice: InvoiceForMatching
): MatchResult | null {
  if (transactions.length < 2) {
    return null;
  }

  // Sum transaction amounts
  let totalTxCents = 0;
  const currency = transactions[0].currency;

  for (const tx of transactions) {
    if (tx.currency !== currency) {
      return null; // Mixed currencies
    }
    const amount = amountFromDecimal(tx.amount, tx.currency);
    totalTxCents += Math.abs(amount.cents);
  }

  // Check if sum matches invoice
  const invoiceAmount = amountFromDecimal(invoice.totalGross, invoice.currency);

  if (invoice.currency !== currency) {
    return null;
  }

  const diff = Math.abs(totalTxCents - Math.abs(invoiceAmount.cents));
  const tolerance = Math.abs(invoiceAmount.cents) * 0.01; // 1% tolerance

  if (diff > tolerance) {
    return null;
  }

  // Calculate combined score
  const avgDate = transactions.map((tx) => tx.bookingDate).sort()[Math.floor(transactions.length / 2)];

  const baseScore = 75; // Base score for grouped match
  const dateScore = avgDate === invoice.issueDate ? 10 : 0;
  const totalScore = Math.min(100, baseScore + dateScore);

  const candidate: MatchCandidate = {
    bankTxId: transactions[0].id, // Primary tx
    invoiceId: invoice.id,
    score: totalScore,
    scoreBreakdown: {
      total: totalScore,
      amountScore: 40,
      dateScore,
      referenceScore: 0,
      counterpartyScore: 0,
      descriptionScore: 0,
      explanation: `Grouped match: ${transactions.length} transactions sum to invoice amount`,
    },
    matchType: "GROUPED",
  };

  return matchedResult(
    transactions[0].id,
    candidate,
    `Grouped match: ${transactions.length} transactions`
  );
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Scores a single tx-invoice pair
 */
function scoreMatch(tx: TxForMatching, invoice: InvoiceForMatching): ScoreBreakdown {
  const txAmount = amountFromDecimal(tx.amount, tx.currency);
  const invoiceAmount = amountFromDecimal(invoice.totalGross, invoice.currency);

  const input: ScoringInput = {
    txAmount,
    invoiceAmount,
    txDate: tx.bookingDate,
    invoiceDate: invoice.issueDate,
    txDescription: tx.description,
    invoiceSupplier: invoice.supplierName,
    txReference: tx.reference,
    invoiceNumber: invoice.invoiceNumber,
    txCounterparty: tx.counterparty,
  };

  return calculateMatchScore(input);
}
