/**
 * User Intent - Phase 3 Orchestration Layer
 *
 * User intent must be:
 * - Explicit
 * - Typed
 * - Immutable
 * - Auditable
 *
 * UX does nothing without an intent object.
 * Intent-first architecture ensures every user action is traceable.
 *
 * INVARIANT: All UX actions map to exactly one intent type
 * INVARIANT: Intent objects are immutable after creation
 */

// ============================================================================
// FILE INGESTION INTENTS
// ============================================================================

export interface UploadFileIntent {
  readonly type: "UPLOAD_FILE";
  readonly fileId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly filename: string;
  readonly kind: "BANK_CSV" | "INVOICE_PDF" | "EXPORT";
  readonly timestamp: number;
}

export interface RetryUploadIntent {
  readonly type: "RETRY_UPLOAD";
  readonly fileId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

export interface CancelUploadIntent {
  readonly type: "CANCEL_UPLOAD";
  readonly fileId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

// ============================================================================
// FILE PARSING INTENTS
// ============================================================================

export interface RequestParseIntent {
  readonly type: "REQUEST_PARSE";
  readonly fileId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

export interface RetryParseIntent {
  readonly type: "RETRY_PARSE";
  readonly fileId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

// ============================================================================
// MATCHING INTENTS
// ============================================================================

export interface RequestMatchIntent {
  readonly type: "REQUEST_MATCH";
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly timestamp: number;
}

export interface ConfirmMatchIntent {
  readonly type: "CONFIRM_MATCH";
  readonly matchId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly timestamp: number;
}

export interface RejectMatchIntent {
  readonly type: "REJECT_MATCH";
  readonly matchId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly timestamp: number;
}

export interface ConfirmAllMatchesIntent {
  readonly type: "CONFIRM_ALL_MATCHES";
  readonly matchIds: readonly string[];
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly timestamp: number;
}

// ============================================================================
// INVOICE INTENTS
// ============================================================================

export interface CreateInvoiceIntent {
  readonly type: "CREATE_INVOICE";
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly sourceFileId: string;
  readonly timestamp: number;
}

export interface CreateInvoiceManualIntent {
  readonly type: "CREATE_INVOICE_MANUAL";
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly supplierName: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly vatRate?: number;
  readonly timestamp: number;
}

// ============================================================================
// MONTH CLOSE INTENTS
// ============================================================================

export interface CreateMonthCloseIntent {
  readonly type: "CREATE_MONTH_CLOSE";
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: "EUR";
  readonly timestamp: number;
}

export interface SubmitForReviewIntent {
  readonly type: "SUBMIT_FOR_REVIEW";
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

export interface ReturnToDraftIntent {
  readonly type: "RETURN_TO_DRAFT";
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

export interface FinalizeMonthIntent {
  readonly type: "FINALIZE_MONTH";
  readonly monthCloseId: string;
  readonly tenantId: string;
  /** User explicitly confirms irreversible action */
  readonly confirmIrreversible: true;
  readonly timestamp: number;
}

export interface ComputeAggregatesIntent {
  readonly type: "COMPUTE_AGGREGATES";
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly timestamp: number;
}

// ============================================================================
// UNION TYPE - ALL INTENTS
// ============================================================================

export type UserIntent =
  // File Ingestion
  | UploadFileIntent
  | RetryUploadIntent
  | CancelUploadIntent
  // Parsing
  | RequestParseIntent
  | RetryParseIntent
  // Matching
  | RequestMatchIntent
  | ConfirmMatchIntent
  | RejectMatchIntent
  | ConfirmAllMatchesIntent
  // Invoice
  | CreateInvoiceIntent
  | CreateInvoiceManualIntent
  // Month Close
  | CreateMonthCloseIntent
  | SubmitForReviewIntent
  | ReturnToDraftIntent
  | FinalizeMonthIntent
  | ComputeAggregatesIntent;

// ============================================================================
// INTENT FACTORIES - Ensure consistent creation
// ============================================================================

/**
 * Creates an upload file intent
 */
export function createUploadFileIntent(params: {
  fileId: string;
  tenantId: string;
  monthCloseId: string;
  filename: string;
  kind: "BANK_CSV" | "INVOICE_PDF" | "EXPORT";
}): UploadFileIntent {
  return {
    type: "UPLOAD_FILE",
    fileId: params.fileId,
    tenantId: params.tenantId,
    monthCloseId: params.monthCloseId,
    filename: params.filename,
    kind: params.kind,
    timestamp: Date.now(),
  };
}

/**
 * Creates a request parse intent
 */
export function createRequestParseIntent(params: {
  fileId: string;
  tenantId: string;
}): RequestParseIntent {
  return {
    type: "REQUEST_PARSE",
    fileId: params.fileId,
    tenantId: params.tenantId,
    timestamp: Date.now(),
  };
}

/**
 * Creates a request match intent
 */
export function createRequestMatchIntent(params: {
  tenantId: string;
  monthCloseId: string;
}): RequestMatchIntent {
  return {
    type: "REQUEST_MATCH",
    tenantId: params.tenantId,
    monthCloseId: params.monthCloseId,
    timestamp: Date.now(),
  };
}

/**
 * Creates a confirm match intent
 */
export function createConfirmMatchIntent(params: {
  matchId: string;
  tenantId: string;
  monthCloseId: string;
}): ConfirmMatchIntent {
  return {
    type: "CONFIRM_MATCH",
    matchId: params.matchId,
    tenantId: params.tenantId,
    monthCloseId: params.monthCloseId,
    timestamp: Date.now(),
  };
}

/**
 * Creates a reject match intent
 */
export function createRejectMatchIntent(params: {
  matchId: string;
  tenantId: string;
  monthCloseId: string;
}): RejectMatchIntent {
  return {
    type: "REJECT_MATCH",
    matchId: params.matchId,
    tenantId: params.tenantId,
    monthCloseId: params.monthCloseId,
    timestamp: Date.now(),
  };
}

/**
 * Creates a submit for review intent
 */
export function createSubmitForReviewIntent(params: {
  monthCloseId: string;
  tenantId: string;
}): SubmitForReviewIntent {
  return {
    type: "SUBMIT_FOR_REVIEW",
    monthCloseId: params.monthCloseId,
    tenantId: params.tenantId,
    timestamp: Date.now(),
  };
}

/**
 * Creates a finalize month intent - requires explicit confirmation
 */
export function createFinalizeMonthIntent(params: {
  monthCloseId: string;
  tenantId: string;
}): FinalizeMonthIntent {
  return {
    type: "FINALIZE_MONTH",
    monthCloseId: params.monthCloseId,
    tenantId: params.tenantId,
    confirmIrreversible: true,
    timestamp: Date.now(),
  };
}

/**
 * Creates a create month close intent
 */
export function createMonthCloseIntent(params: {
  monthCloseId: string;
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  currency: "EUR";
}): CreateMonthCloseIntent {
  return {
    type: "CREATE_MONTH_CLOSE",
    monthCloseId: params.monthCloseId,
    tenantId: params.tenantId,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
    currency: params.currency,
    timestamp: Date.now(),
  };
}

// ============================================================================
// INTENT VALIDATION
// ============================================================================

/**
 * Validates that an intent has all required fields
 */
export function isValidIntent(intent: unknown): intent is UserIntent {
  if (!intent || typeof intent !== "object") return false;
  const obj = intent as Record<string, unknown>;
  if (!obj.type || typeof obj.type !== "string") return false;
  if (!obj.timestamp || typeof obj.timestamp !== "number") return false;
  return true;
}

/**
 * Human-readable description of an intent for logging/UI
 */
export function describeIntent(intent: UserIntent): string {
  switch (intent.type) {
    case "UPLOAD_FILE":
      return `Upload file "${intent.filename}" (${intent.kind})`;
    case "RETRY_UPLOAD":
      return `Retry upload for file ${intent.fileId}`;
    case "CANCEL_UPLOAD":
      return `Cancel upload for file ${intent.fileId}`;
    case "REQUEST_PARSE":
      return `Parse file ${intent.fileId}`;
    case "RETRY_PARSE":
      return `Retry parsing file ${intent.fileId}`;
    case "REQUEST_MATCH":
      return `Run matching for month close ${intent.monthCloseId}`;
    case "CONFIRM_MATCH":
      return `Confirm match ${intent.matchId}`;
    case "REJECT_MATCH":
      return `Reject match ${intent.matchId}`;
    case "CONFIRM_ALL_MATCHES":
      return `Confirm ${intent.matchIds.length} matches`;
    case "CREATE_INVOICE":
      return `Create invoice from file ${intent.sourceFileId}`;
    case "CREATE_INVOICE_MANUAL":
      return `Create manual invoice ${intent.invoiceNumber}`;
    case "CREATE_MONTH_CLOSE":
      return `Create month close for ${intent.periodStart.toISOString().slice(0, 7)}`;
    case "SUBMIT_FOR_REVIEW":
      return `Submit month close ${intent.monthCloseId} for review`;
    case "RETURN_TO_DRAFT":
      return `Return month close ${intent.monthCloseId} to draft`;
    case "FINALIZE_MONTH":
      return `FINALIZE month close ${intent.monthCloseId} (IRREVERSIBLE)`;
    case "COMPUTE_AGGREGATES":
      return `Compute aggregates for month close ${intent.monthCloseId}`;
  }
}
