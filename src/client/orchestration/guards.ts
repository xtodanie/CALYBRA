/**
 * Guards - Permission and state validation
 *
 * Guards block invalid actions BEFORE execution.
 * They are pure functions that check:
 * - User permissions (RBAC)
 * - Current entity state (status machine validity)
 * - Business invariants
 *
 * INVARIANT: Guards never mutate state
 * INVARIANT: Guards return deterministic results
 * INVARIANT: Guards provide human-readable explanations
 */

import { UserIntent } from "./intent";
import { UserRole, MonthCloseStatus, MatchStatus, FileAssetStatus } from "@/lib/types";
import { Permission, ROLE_PERMISSIONS } from "@/domain/rbac";

// ============================================================================
// GUARD RESULT TYPES
// ============================================================================

export interface GuardSuccess {
  readonly allowed: true;
}

export interface GuardFailure {
  readonly allowed: false;
  readonly code: string;
  readonly reason: string;
  readonly userMessage: string;
}

export type GuardResult = GuardSuccess | GuardFailure;

export function guardSuccess(): GuardSuccess {
  return { allowed: true };
}

export function guardFailure(
  code: string,
  reason: string,
  userMessage: string
): GuardFailure {
  return { allowed: false, code, reason, userMessage };
}

// ============================================================================
// PERMISSION GUARDS
// ============================================================================

/**
 * Checks if user has required permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/**
 * Guards an action based on required permission
 */
export function guardPermission(
  role: UserRole,
  permission: Permission
): GuardResult {
  if (hasPermission(role, permission)) {
    return guardSuccess();
  }
  return guardFailure(
    "PERMISSION_DENIED",
    `Role ${role} lacks permission ${permission}`,
    `You don't have permission to perform this action. Required: ${permission}`
  );
}

// ============================================================================
// INTENT-SPECIFIC GUARDS
// ============================================================================

/**
 * Guard for upload file intent
 */
export function guardUploadFile(
  role: UserRole,
  monthCloseStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.FILE_ASSET_CREATE);
  if (!permResult.allowed) return permResult;

  // Check month close is not finalized
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return guardFailure(
      "MONTH_CLOSE_FINALIZED",
      "Cannot upload files to a finalized month close",
      "This month has been finalized. Files cannot be added."
    );
  }

  return guardSuccess();
}

/**
 * Guard for request parse intent
 */
export function guardRequestParse(
  role: UserRole,
  fileStatus: FileAssetStatus,
  parseStatus: string | undefined
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.FILE_ASSET_CREATE);
  if (!permResult.allowed) return permResult;

  // Check file is uploaded
  if (fileStatus !== FileAssetStatus.UPLOADED && fileStatus !== FileAssetStatus.VERIFIED) {
    return guardFailure(
      "FILE_NOT_READY",
      `File status is ${fileStatus}, expected UPLOADED or VERIFIED`,
      "This file is not ready for parsing. Please wait for upload to complete."
    );
  }

  // Check parse status allows retry
  if (parseStatus === "PARSED") {
    return guardFailure(
      "ALREADY_PARSED",
      "File has already been parsed",
      "This file has already been parsed. Use the parsed data or delete and re-upload."
    );
  }

  return guardSuccess();
}

/**
 * Guard for request match intent
 */
export function guardRequestMatch(
  role: UserRole,
  monthCloseStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.MATCH_CONFIRM);
  if (!permResult.allowed) return permResult;

  // Check month close allows matching
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return guardFailure(
      "MONTH_CLOSE_FINALIZED",
      "Cannot run matching on a finalized month close",
      "This month has been finalized. Matching cannot be modified."
    );
  }

  return guardSuccess();
}

/**
 * Guard for confirm match intent
 */
export function guardConfirmMatch(
  role: UserRole,
  matchStatus: MatchStatus,
  monthCloseStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.MATCH_CONFIRM);
  if (!permResult.allowed) return permResult;

  // Check month close is not finalized
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return guardFailure(
      "MONTH_CLOSE_FINALIZED",
      "Cannot confirm match on a finalized month close",
      "This month has been finalized. Matches cannot be modified."
    );
  }

  // Check match is in correct status
  if (matchStatus !== MatchStatus.PROPOSED) {
    return guardFailure(
      "INVALID_MATCH_STATUS",
      `Match status is ${matchStatus}, expected PROPOSED`,
      `This match cannot be confirmed. Current status: ${matchStatus}`
    );
  }

  return guardSuccess();
}

/**
 * Guard for reject match intent
 */
export function guardRejectMatch(
  role: UserRole,
  matchStatus: MatchStatus,
  monthCloseStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.MATCH_REJECT);
  if (!permResult.allowed) return permResult;

  // Check month close is not finalized
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return guardFailure(
      "MONTH_CLOSE_FINALIZED",
      "Cannot reject match on a finalized month close",
      "This month has been finalized. Matches cannot be modified."
    );
  }

  // Check match is in correct status
  if (matchStatus !== MatchStatus.PROPOSED) {
    return guardFailure(
      "INVALID_MATCH_STATUS",
      `Match status is ${matchStatus}, expected PROPOSED`,
      `This match cannot be rejected. Current status: ${matchStatus}`
    );
  }

  return guardSuccess();
}

/**
 * Guard for submit for review intent
 */
export function guardSubmitForReview(
  role: UserRole,
  currentStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.MONTH_CLOSE_TRANSITION);
  if (!permResult.allowed) return permResult;

  // Check transition is valid
  if (currentStatus !== MonthCloseStatus.DRAFT) {
    return guardFailure(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from ${currentStatus} to IN_REVIEW`,
      `Month close must be in DRAFT status to submit for review. Current status: ${currentStatus}`
    );
  }

  return guardSuccess();
}

/**
 * Guard for return to draft intent
 */
export function guardReturnToDraft(
  role: UserRole,
  currentStatus: MonthCloseStatus
): GuardResult {
  // Check permission
  const permResult = guardPermission(role, Permission.MONTH_CLOSE_TRANSITION);
  if (!permResult.allowed) return permResult;

  // Check transition is valid
  if (currentStatus !== MonthCloseStatus.IN_REVIEW) {
    return guardFailure(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from ${currentStatus} to DRAFT`,
      `Month close must be IN_REVIEW status to return to draft. Current status: ${currentStatus}`
    );
  }

  return guardSuccess();
}

/**
 * Guard for finalize month intent
 */
export function guardFinalizeMonth(
  role: UserRole,
  currentStatus: MonthCloseStatus,
  openExceptionsCount: number,
  highExceptionsCount: number
): GuardResult {
  // Check permission - finalize requires special permission
  const permResult = guardPermission(role, Permission.MONTH_CLOSE_FINALIZE);
  if (!permResult.allowed) return permResult;

  // Check current status is IN_REVIEW
  if (currentStatus !== MonthCloseStatus.IN_REVIEW) {
    return guardFailure(
      "INVALID_STATUS_TRANSITION",
      `Cannot finalize from ${currentStatus}, must be IN_REVIEW`,
      `Month close must be IN_REVIEW status to finalize. Current status: ${currentStatus}`
    );
  }

  // Check no open exceptions
  if (openExceptionsCount > 0) {
    return guardFailure(
      "OPEN_EXCEPTIONS",
      `Cannot finalize with ${openExceptionsCount} open exceptions`,
      `Cannot finalize with ${openExceptionsCount} unresolved exceptions. Please resolve all exceptions first.`
    );
  }

  // Check no high priority exceptions
  if (highExceptionsCount > 0) {
    return guardFailure(
      "HIGH_PRIORITY_EXCEPTIONS",
      `Cannot finalize with ${highExceptionsCount} high priority exceptions`,
      `Cannot finalize with ${highExceptionsCount} high-priority issues. These must be resolved.`
    );
  }

  return guardSuccess();
}

/**
 * Guard for create month close intent
 */
export function guardCreateMonthClose(
  role: UserRole
): GuardResult {
  return guardPermission(role, Permission.MONTH_CLOSE_CREATE);
}

/**
 * Guard for create invoice intent
 */
export function guardCreateInvoice(
  role: UserRole,
  monthCloseStatus: MonthCloseStatus
): GuardResult {
  // Invoices are server-created, but we check if the month allows modifications
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return guardFailure(
      "MONTH_CLOSE_FINALIZED",
      "Cannot create invoices in a finalized month close",
      "This month has been finalized. Invoices cannot be added."
    );
  }

  return guardSuccess();
}

// ============================================================================
// MASTER INTENT GUARD
// ============================================================================

export interface IntentGuardContext {
  readonly role: UserRole;
  readonly monthCloseStatus?: MonthCloseStatus;
  readonly matchStatus?: MatchStatus;
  readonly fileStatus?: FileAssetStatus;
  readonly parseStatus?: string;
  readonly openExceptionsCount?: number;
  readonly highExceptionsCount?: number;
}

/**
 * Master guard that validates any intent against the current context
 */
export function guardIntent(
  intent: UserIntent,
  context: IntentGuardContext
): GuardResult {
  switch (intent.type) {
    case "UPLOAD_FILE":
    case "RETRY_UPLOAD":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardUploadFile(context.role, context.monthCloseStatus);

    case "CANCEL_UPLOAD":
      return guardPermission(context.role, Permission.FILE_ASSET_CREATE);

    case "REQUEST_PARSE":
    case "RETRY_PARSE":
      if (!context.fileStatus) {
        return guardFailure("MISSING_CONTEXT", "File status required", "Unable to determine file status");
      }
      return guardRequestParse(context.role, context.fileStatus, context.parseStatus);

    case "REQUEST_MATCH":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardRequestMatch(context.role, context.monthCloseStatus);

    case "CONFIRM_MATCH":
      if (!context.matchStatus || !context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Match and month close status required", "Unable to determine current status");
      }
      return guardConfirmMatch(context.role, context.matchStatus, context.monthCloseStatus);

    case "REJECT_MATCH":
      if (!context.matchStatus || !context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Match and month close status required", "Unable to determine current status");
      }
      return guardRejectMatch(context.role, context.matchStatus, context.monthCloseStatus);

    case "CONFIRM_ALL_MATCHES":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardRequestMatch(context.role, context.monthCloseStatus);

    case "CREATE_INVOICE":
    case "CREATE_INVOICE_MANUAL":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardCreateInvoice(context.role, context.monthCloseStatus);

    case "CREATE_MONTH_CLOSE":
      return guardCreateMonthClose(context.role);

    case "SUBMIT_FOR_REVIEW":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardSubmitForReview(context.role, context.monthCloseStatus);

    case "RETURN_TO_DRAFT":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardReturnToDraft(context.role, context.monthCloseStatus);

    case "FINALIZE_MONTH":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      return guardFinalizeMonth(
        context.role,
        context.monthCloseStatus,
        context.openExceptionsCount ?? 0,
        context.highExceptionsCount ?? 0
      );

    case "COMPUTE_AGGREGATES":
      if (!context.monthCloseStatus) {
        return guardFailure("MISSING_CONTEXT", "Month close status required", "Unable to determine month status");
      }
      if (context.monthCloseStatus === MonthCloseStatus.FINALIZED) {
        return guardFailure(
          "MONTH_CLOSE_FINALIZED",
          "Cannot recompute finalized month",
          "This month has been finalized and cannot be changed."
        );
      }
      return guardPermission(context.role, Permission.MONTH_CLOSE_UPDATE);
  }
}
