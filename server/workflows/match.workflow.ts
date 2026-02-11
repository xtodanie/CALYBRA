/**
 * Match Workflow
 * Orchestration layer. Calls logic + persistence.
 *
 * STEP 3 — Matching
 * - Compare transactions to invoices
 * - Produce match suggestions
 * - Store proposed matches
 *
 * INVARIANT: Matching NEVER finalizes
 * INVARIANT: Matching NEVER writes truth
 * INVARIANT: Matching can be rerun infinitely
 */

import { Firestore } from "firebase-admin/firestore";
import { WriteContext, createMatchBatch, updateMatch, CreateMatchInput } from "../persistence/write";
import {
  readBankTxByMonthClose,
  readInvoicesByMonthClose,
  readConfirmedMatches,
  readMatch,
} from "../persistence/read";
import {
  matchAllTransactions,
  TxForMatching,
  InvoiceForMatching,
  ExclusionSet,
} from "../logic/matching/matchInvoiceToTx";
import { assertMatchTransition, assertMatchNotTerminal, MatchStatus } from "../state/statusMachine";
import { canConfirmMatch, validateMatchReferences } from "../state/invariants";

/**
 * Input for running matching workflow
 */
export interface RunMatchingInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
}

/**
 * Result of matching workflow
 */
export interface RunMatchingResult {
  readonly success: true;
  readonly matched: number;
  readonly ambiguous: number;
  readonly unmatched: number;
  readonly matchIds: readonly string[];
}

/**
 * Error from matching workflow
 */
export interface RunMatchingError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type RunMatchingOutcome = RunMatchingResult | RunMatchingError;

/**
 * Runs the matching algorithm and stores proposed matches
 *
 * @param db - Firestore instance
 * @param ctx - Write context
 * @param input - Matching input
 * @returns RunMatchingOutcome
 */
export async function runMatching(
  db: Firestore,
  ctx: WriteContext,
  input: RunMatchingInput
): Promise<RunMatchingOutcome> {
  // Validate input
  if (!input.tenantId || !input.monthCloseId) {
    return { success: false, code: "INVALID_INPUT", message: "tenantId and monthCloseId are required" };
  }

  // Load all transactions
  const storedTx = await readBankTxByMonthClose(db, input.tenantId, input.monthCloseId);

  // Load all invoices
  const storedInvoices = await readInvoicesByMonthClose(db, input.tenantId, input.monthCloseId);

  if (storedTx.length === 0) {
    return { success: false, code: "NO_DATA", message: "No transactions found for matching" };
  }

  if (storedInvoices.length === 0) {
    return { success: false, code: "NO_DATA", message: "No invoices found for matching" };
  }

  // Load existing confirmed matches for exclusion
  const confirmedMatches = await readConfirmedMatches(db, input.tenantId, input.monthCloseId);

  // Build exclusion set
  const matchedTxIds = new Set<string>();
  const matchedInvoiceIds = new Set<string>();

  for (const match of confirmedMatches) {
    for (const txId of match.bankTxIds) {
      matchedTxIds.add(txId);
    }
    for (const invId of match.invoiceIds) {
      matchedInvoiceIds.add(invId);
    }
  }

  const exclusions: ExclusionSet = { matchedTxIds, matchedInvoiceIds };

  // Convert to matching format
  // ASSUMPTION: Default currency is EUR if not specified (deterministic default)
  const DEFAULT_CURRENCY = "EUR" as const;

  const transactions: TxForMatching[] = storedTx.map((tx) => ({
    id: tx.id,
    bookingDate: tx.bookingDate,
    amount: tx.amount,
    currency: DEFAULT_CURRENCY,
    description: tx.descriptionRaw,
    counterparty: tx.counterpartyRaw,
    reference: tx.referenceRaw,
  }));

  const invoices: InvoiceForMatching[] = storedInvoices.map((inv) => ({
    id: inv.id,
    issueDate: inv.issueDate,
    totalGross: inv.totalGross,
    currency: DEFAULT_CURRENCY,
    supplierName: inv.supplierNameRaw,
    invoiceNumber: inv.invoiceNumber,
  }));

  // Run matching
  const results = matchAllTransactions(transactions, invoices, exclusions);

  // Store proposed matches
  const matchesToCreate: CreateMatchInput[] = [];
  let matchedCount = 0;
  let ambiguousCount = 0;
  let unmatchedCount = 0;

  for (const result of results) {
    switch (result.status) {
      case "MATCHED":
        matchedCount++;
        if (result.candidates.length === 1) {
          const candidate = result.candidates[0];
          matchesToCreate.push({
            id: generateMatchId(input.monthCloseId, result.bankTxId),
            tenantId: input.tenantId,
            monthCloseId: input.monthCloseId,
            bankTxIds: [result.bankTxId],
            invoiceIds: [candidate.invoiceId],
            matchType: candidate.matchType,
            score: candidate.score,
            status: "PROPOSED",
            explanationKey: "match.auto",
            explanationParams: {
              score: candidate.score,
              type: candidate.matchType,
            },
          });
        }
        break;

      case "AMBIGUOUS":
        ambiguousCount++;
        // For ambiguous, create a match with top candidate but flag it
        if (result.candidates.length > 0) {
          const topCandidate = result.candidates[0];
          matchesToCreate.push({
            id: generateMatchId(input.monthCloseId, result.bankTxId),
            tenantId: input.tenantId,
            monthCloseId: input.monthCloseId,
            bankTxIds: [result.bankTxId],
            invoiceIds: [topCandidate.invoiceId],
            matchType: "FUZZY",
            score: topCandidate.score,
            status: "PROPOSED",
            explanationKey: "match.ambiguous",
            explanationParams: {
              candidateCount: result.candidates.length,
              topScore: topCandidate.score,
            },
          });
        }
        break;

      case "UNMATCHED":
        unmatchedCount++;
        break;
    }
  }

  // Batch create matches
  if (matchesToCreate.length > 0) {
    await createMatchBatch(db, ctx, matchesToCreate);
  }

  return {
    success: true,
    matched: matchedCount,
    ambiguous: ambiguousCount,
    unmatched: unmatchedCount,
    matchIds: matchesToCreate.map((m) => m.id),
  };
}

/**
 * Confirms a proposed match
 */
export interface ConfirmMatchInput {
  readonly tenantId: string;
  readonly matchId: string;
}

export interface ConfirmMatchResult {
  readonly success: true;
  readonly matchId: string;
  readonly status: string;
}

export interface ConfirmMatchError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type ConfirmMatchOutcome = ConfirmMatchResult | ConfirmMatchError;

export async function confirmMatch(
  db: Firestore,
  ctx: WriteContext,
  input: ConfirmMatchInput
): Promise<ConfirmMatchOutcome> {
  // Read match
  const match = await readMatch(db, input.tenantId, input.matchId);
  if (!match) {
    return { success: false, code: "NOT_FOUND", message: `Match ${input.matchId} not found` };
  }

  // Validate transition
  try {
    assertMatchNotTerminal(match.status as MatchStatus);
    assertMatchTransition(match.status as MatchStatus, "CONFIRMED");
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      message: err instanceof Error ? err.message : "Invalid transition",
    };
  }

  // Validate references
  const refValidation = validateMatchReferences(match.bankTxIds, match.invoiceIds);
  if (!refValidation.valid) {
    return { success: false, code: refValidation.code, message: refValidation.message };
  }

  // Check for conflicts with other confirmed matches
  const confirmedMatches = await readConfirmedMatches(db, input.tenantId, match.monthCloseId);

  const alreadyMatchedTxIds = new Set<string>();
  const alreadyMatchedInvoiceIds = new Set<string>();

  for (const cm of confirmedMatches) {
    for (const txId of cm.bankTxIds) {
      alreadyMatchedTxIds.add(txId);
    }
    for (const invId of cm.invoiceIds) {
      alreadyMatchedInvoiceIds.add(invId);
    }
  }

  const confirmValidation = canConfirmMatch(
    match.status as MatchStatus,
    match.bankTxIds,
    match.invoiceIds,
    alreadyMatchedTxIds,
    alreadyMatchedInvoiceIds
  );

  if (!confirmValidation.valid) {
    return { success: false, code: confirmValidation.code, message: confirmValidation.message };
  }

  // Confirm the match
  await updateMatch(db, ctx, input.tenantId, input.matchId, {
    status: "CONFIRMED",
    confirmedBy: ctx.actorId,
    confirmedAt: ctx.now,
  });

  return {
    success: true,
    matchId: input.matchId,
    status: "CONFIRMED",
  };
}

/**
 * Rejects a proposed match
 */
export interface RejectMatchInput {
  readonly tenantId: string;
  readonly matchId: string;
  readonly reason?: string;
}

export type RejectMatchOutcome = ConfirmMatchResult | ConfirmMatchError;

export async function rejectMatch(
  db: Firestore,
  ctx: WriteContext,
  input: RejectMatchInput
): Promise<RejectMatchOutcome> {
  // Read match
  const match = await readMatch(db, input.tenantId, input.matchId);
  if (!match) {
    return { success: false, code: "NOT_FOUND", message: `Match ${input.matchId} not found` };
  }

  // Validate transition
  try {
    assertMatchNotTerminal(match.status as MatchStatus);
    assertMatchTransition(match.status as MatchStatus, "REJECTED");
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      message: err instanceof Error ? err.message : "Invalid transition",
    };
  }

  // Reject the match
  await updateMatch(db, ctx, input.tenantId, input.matchId, {
    status: "REJECTED",
    reason: input.reason,
  });

  return {
    success: true,
    matchId: input.matchId,
    status: "REJECTED",
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function generateMatchId(monthCloseId: string, txId: string): string {
  return `${monthCloseId}_${txId}`;
}
