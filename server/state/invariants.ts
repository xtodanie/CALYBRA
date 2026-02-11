/**
 * Invariants - Business rule enforcement
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: These rules are enforced before any state mutation
 */

import {
  MonthCloseStatus,
  FileAssetStatus,
  isMonthCloseTerminal,
  isFileAssetTerminal,
  isMatchTerminal,
  MatchStatus,
} from "./statusMachine";

// ============================================================================
// VALIDATION RESULT TYPES
// ============================================================================

export interface ValidationSuccess {
  readonly valid: true;
}

export interface ValidationFailure {
  readonly valid: false;
  readonly code: string;
  readonly message: string;
}

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function validationSuccess(): ValidationSuccess {
  return { valid: true };
}

export function validationFailure(code: string, message: string): ValidationFailure {
  return { valid: false, code, message };
}

// ============================================================================
// MONTH CLOSE INVARIANTS
// ============================================================================

/**
 * INV-MC-001: MonthClose cannot be finalized with open exceptions
 */
export function canFinalizeMonthClose(
  currentStatus: MonthCloseStatus,
  openExceptionsCount: number,
  highExceptionsCount: number
): ValidationResult {
  if (currentStatus !== "IN_REVIEW") {
    return validationFailure(
      "INV-MC-001",
      `MonthClose must be IN_REVIEW to finalize, current: ${currentStatus}`
    );
  }

  if (openExceptionsCount > 0) {
    return validationFailure(
      "INV-MC-002",
      `Cannot finalize MonthClose with ${openExceptionsCount} open exceptions`
    );
  }

  if (highExceptionsCount > 0) {
    return validationFailure(
      "INV-MC-003",
      `Cannot finalize MonthClose with ${highExceptionsCount} high-priority exceptions`
    );
  }

  return validationSuccess();
}

/**
 * INV-MC-004: Finalized MonthClose is immutable
 */
export function canModifyMonthClose(status: MonthCloseStatus): ValidationResult {
  if (isMonthCloseTerminal(status)) {
    return validationFailure(
      "INV-MC-004",
      "FINALIZED MonthClose is immutable"
    );
  }
  return validationSuccess();
}

/**
 * INV-MC-005: MonthClose periods must not overlap within tenant
 */
export function validateMonthClosePeriod(
  newStart: string,
  newEnd: string,
  existingPeriods: readonly { start: string; end: string }[]
): ValidationResult {
  for (const existing of existingPeriods) {
    if (periodsOverlap(newStart, newEnd, existing.start, existing.end)) {
      return validationFailure(
        "INV-MC-005",
        `MonthClose period overlaps with existing period: ${existing.start} to ${existing.end}`
      );
    }
  }
  return validationSuccess();
}

// ============================================================================
// FILE ASSET INVARIANTS
// ============================================================================

/**
 * INV-FA-001: Deleted FileAsset is immutable
 */
export function canModifyFileAsset(status: FileAssetStatus): ValidationResult {
  if (isFileAssetTerminal(status)) {
    return validationFailure(
      "INV-FA-001",
      "DELETED FileAsset is immutable"
    );
  }
  return validationSuccess();
}

/**
 * INV-FA-002: FileAsset can only be verified after successful parse
 */
export function canVerifyFileAsset(
  status: FileAssetStatus,
  parseStatus: string | undefined
): ValidationResult {
  if (status !== "UPLOADED") {
    return validationFailure(
      "INV-FA-002",
      `FileAsset must be UPLOADED to verify, current: ${status}`
    );
  }

  if (parseStatus !== "PARSED") {
    return validationFailure(
      "INV-FA-003",
      `FileAsset must be PARSED to verify, parseStatus: ${parseStatus ?? "undefined"}`
    );
  }

  return validationSuccess();
}

// ============================================================================
// MATCH INVARIANTS
// ============================================================================

/**
 * INV-MA-001: Terminal match (CONFIRMED/REJECTED) is immutable
 */
export function canModifyMatch(status: MatchStatus): ValidationResult {
  if (isMatchTerminal(status)) {
    return validationFailure(
      "INV-MA-001",
      `Match in terminal status '${status}' is immutable`
    );
  }
  return validationSuccess();
}

/**
 * INV-MA-002: Match must have at least one transaction and one invoice
 */
export function validateMatchReferences(
  bankTxIds: readonly string[],
  invoiceIds: readonly string[]
): ValidationResult {
  if (bankTxIds.length === 0) {
    return validationFailure(
      "INV-MA-002",
      "Match must reference at least one bank transaction"
    );
  }

  if (invoiceIds.length === 0) {
    return validationFailure(
      "INV-MA-003",
      "Match must reference at least one invoice"
    );
  }

  return validationSuccess();
}

/**
 * INV-MA-004: Match cannot be confirmed if any linked entity is in invalid state
 */
export function canConfirmMatch(
  matchStatus: MatchStatus,
  linkedTxIds: readonly string[],
  linkedInvoiceIds: readonly string[],
  alreadyMatchedTxIds: ReadonlySet<string>,
  alreadyMatchedInvoiceIds: ReadonlySet<string>
): ValidationResult {
  if (matchStatus !== "PROPOSED") {
    return validationFailure(
      "INV-MA-004",
      `Match must be PROPOSED to confirm, current: ${matchStatus}`
    );
  }

  // Check for already matched transactions
  for (const txId of linkedTxIds) {
    if (alreadyMatchedTxIds.has(txId)) {
      return validationFailure(
        "INV-MA-005",
        `Transaction ${txId} is already matched`
      );
    }
  }

  // Check for already matched invoices
  for (const invoiceId of linkedInvoiceIds) {
    if (alreadyMatchedInvoiceIds.has(invoiceId)) {
      return validationFailure(
        "INV-MA-006",
        `Invoice ${invoiceId} is already matched`
      );
    }
  }

  return validationSuccess();
}

// ============================================================================
// HELPERS
// ============================================================================

function periodsOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 <= end2 && start2 <= end1;
}
