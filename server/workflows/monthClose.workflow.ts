/**
 * Month Close Workflow
 * Orchestration layer. Calls logic + persistence + state machine.
 *
 * STEP 5 & 6 — Month Close Calculation & Finalization
 * - Gather inputs (transactions, invoices, matches)
 * - Compute totals, balances, reconciliation
 * - Enforce terminal state immutability
 *
 * INVARIANT: MonthClose is a RESULT, not a source of truth
 * INVARIANT: Must be deletable and rebuildable to the same output
 * INVARIANT: FINALIZED status is terminal and immutable
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";
import {
  WriteContext,
  createMonthClose,
  updateMonthClose,
} from "../persistence/write";
import {
  readMonthClose,
  readMonthCloses,
  readBankTxByMonthClose,
  readInvoicesByMonthClose,
  readMatchesByMonthClose,
} from "../persistence/read";
import { computeMonthClose, MonthCloseInput, MonthCloseResult } from "../logic/accounting/computeMonthClose";
import {
  assertMonthCloseTransition,
  assertMonthCloseNotTerminal,
  MonthCloseStatus,
} from "../state/statusMachine";
import { canFinalizeMonthClose, canModifyMonthClose, validateMonthClosePeriod } from "../state/invariants";
import { CurrencyCode } from "../domain/money";

/**
 * Input for creating a month close
 */
export interface CreateMonthCloseWorkflowInput {
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly periodStart: Timestamp;
  readonly periodEnd: Timestamp;
  readonly currency: CurrencyCode;
}

/**
 * Result of month close creation
 */
export interface CreateMonthCloseResult {
  readonly success: true;
  readonly monthCloseId: string;
  readonly status: string;
}

/**
 * Error from month close workflow
 */
export interface MonthCloseWorkflowError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type CreateMonthCloseOutcome = CreateMonthCloseResult | MonthCloseWorkflowError;

/**
 * Creates a new month close in DRAFT status
 */
export async function createMonthCloseWorkflow(
  db: Firestore,
  ctx: WriteContext,
  input: CreateMonthCloseWorkflowInput
): Promise<CreateMonthCloseOutcome> {
  // Validate input
  if (!input.monthCloseId || !input.tenantId) {
    return { success: false, code: "INVALID_INPUT", message: "monthCloseId and tenantId are required" };
  }

  // Check doesn't already exist
  const existing = await readMonthClose(db, input.tenantId, input.monthCloseId);
  if (existing) {
    return { success: false, code: "ALREADY_EXISTS", message: `MonthClose ${input.monthCloseId} already exists` };
  }

  // Check for overlapping periods
  const allMonthCloses = await readMonthCloses(db, input.tenantId);
  const existingPeriods = allMonthCloses.map((mc) => ({
    start: timestampToDateString(mc.periodStart),
    end: timestampToDateString(mc.periodEnd),
  }));

  const periodValidation = validateMonthClosePeriod(
    timestampToDateString(input.periodStart),
    timestampToDateString(input.periodEnd),
    existingPeriods
  );

  if (!periodValidation.valid) {
    return { success: false, code: periodValidation.code, message: periodValidation.message };
  }

  // Create with initial values
  await createMonthClose(db, ctx, {
    id: input.monthCloseId,
    tenantId: input.tenantId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    status: "DRAFT",
    bankTotal: 0,
    invoiceTotal: 0,
    diff: 0,
    openExceptionsCount: 0,
    highExceptionsCount: 0,
  });

  return {
    success: true,
    monthCloseId: input.monthCloseId,
    status: "DRAFT",
  };
}

/**
 * Recomputes month close totals from current data
 */
export interface RecomputeMonthCloseInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
}

export interface RecomputeMonthCloseResult {
  readonly success: true;
  readonly monthCloseId: string;
  readonly computed: MonthCloseResult;
}

export type RecomputeMonthCloseOutcome = RecomputeMonthCloseResult | MonthCloseWorkflowError;

export async function recomputeMonthClose(
  db: Firestore,
  ctx: WriteContext,
  input: RecomputeMonthCloseInput
): Promise<RecomputeMonthCloseOutcome> {
  // Read month close
  const monthClose = await readMonthClose(db, input.tenantId, input.monthCloseId);
  if (!monthClose) {
    return { success: false, code: "NOT_FOUND", message: `MonthClose ${input.monthCloseId} not found` };
  }

  // Check if modifiable
  const modifyCheck = canModifyMonthClose(monthClose.status as MonthCloseStatus);
  if (!modifyCheck.valid) {
    return { success: false, code: modifyCheck.code, message: modifyCheck.message };
  }

  // Gather all data
  const bankTx = await readBankTxByMonthClose(db, input.tenantId, input.monthCloseId);
  const invoices = await readInvoicesByMonthClose(db, input.tenantId, input.monthCloseId);
  const matches = await readMatchesByMonthClose(db, input.tenantId, input.monthCloseId);

  // Separate match statuses
  const confirmedMatches = matches.filter((m) => m.status === "CONFIRMED");
  const proposedMatches = matches.filter((m) => m.status === "PROPOSED");

  // Get matched IDs
  const matchedBankTxIds = new Set<string>();
  const matchedInvoiceIds = new Set<string>();

  for (const match of confirmedMatches) {
    for (const txId of match.bankTxIds) matchedBankTxIds.add(txId);
    for (const invId of match.invoiceIds) matchedInvoiceIds.add(invId);
  }

  // Build computation input
  // ASSUMPTION: Default currency EUR (deterministic)
  const currency: CurrencyCode = "EUR";

  const computeInput: MonthCloseInput = {
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    periodStart: timestampToDateString(monthClose.periodStart),
    periodEnd: timestampToDateString(monthClose.periodEnd),
    currency,
    bankTxAmounts: bankTx.map((tx) => tx.amount),
    invoiceAmounts: invoices.map((inv) => inv.totalGross),
    matchedBankTxAmounts: bankTx.filter((tx) => matchedBankTxIds.has(tx.id)).map((tx) => tx.amount),
    matchedInvoiceAmounts: invoices.filter((inv) => matchedInvoiceIds.has(inv.id)).map((inv) => inv.totalGross),
    proposedMatchCount: proposedMatches.length,
    confirmedMatchCount: confirmedMatches.length,
    lowConfidenceMatchCount: matches.filter((m) => m.score < 70).length,
    ambiguousMatchCount: 0, // Would need to track this separately
  };

  // Compute
  const computed = computeMonthClose(computeInput);

  // Update stored values
  await updateMonthClose(db, ctx, input.tenantId, input.monthCloseId, {
    bankTotal: computed.bankTotal,
    invoiceTotal: computed.invoiceTotal,
    diff: computed.diff,
    openExceptionsCount: computed.openExceptionsCount,
    highExceptionsCount: computed.highExceptionsCount,
  });

  return {
    success: true,
    monthCloseId: input.monthCloseId,
    computed,
  };
}

/**
 * Transitions month close status
 */
export interface TransitionMonthCloseInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly toStatus: MonthCloseStatus;
}

export interface TransitionMonthCloseResult {
  readonly success: true;
  readonly monthCloseId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
}

export type TransitionMonthCloseOutcome = TransitionMonthCloseResult | MonthCloseWorkflowError;

export async function transitionMonthClose(
  db: Firestore,
  ctx: WriteContext,
  input: TransitionMonthCloseInput
): Promise<TransitionMonthCloseOutcome> {
  // Read month close
  const monthClose = await readMonthClose(db, input.tenantId, input.monthCloseId);
  if (!monthClose) {
    return { success: false, code: "NOT_FOUND", message: `MonthClose ${input.monthCloseId} not found` };
  }

  const fromStatus = monthClose.status as MonthCloseStatus;

  // Validate transition
  try {
    assertMonthCloseNotTerminal(fromStatus);
    assertMonthCloseTransition(fromStatus, input.toStatus);
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      message: err instanceof Error ? err.message : "Invalid transition",
    };
  }

  // Special validation for FINALIZED
  if (input.toStatus === "FINALIZED") {
    const finalizeCheck = canFinalizeMonthClose(
      fromStatus,
      monthClose.openExceptionsCount,
      monthClose.highExceptionsCount
    );

    if (!finalizeCheck.valid) {
      return { success: false, code: finalizeCheck.code, message: finalizeCheck.message };
    }
  }

  // Perform transition
  const updates: { status: string; finalizedAt?: Timestamp; finalizedBy?: string } = {
    status: input.toStatus,
  };

  if (input.toStatus === "FINALIZED") {
    updates.finalizedAt = ctx.now;
    updates.finalizedBy = ctx.actorId;
  }

  await updateMonthClose(db, ctx, input.tenantId, input.monthCloseId, updates);

  return {
    success: true,
    monthCloseId: input.monthCloseId,
    fromStatus,
    toStatus: input.toStatus,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function timestampToDateString(ts: FirebaseFirestore.Timestamp): string {
  const date = ts.toDate();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
