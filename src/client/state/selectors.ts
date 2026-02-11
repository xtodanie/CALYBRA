/**
 * State Selectors - Derived state from Firestore documents
 *
 * Selectors are pure functions that:
 * - Read from Firestore snapshots
 * - Compute derived state
 * - Never mutate
 *
 * INVARIANT: UI never guesses state
 * INVARIANT: Selectors are deterministic
 */

import {
  MonthCloseStatus,
  MatchStatus,
  FileAssetStatus,
  ParseStatus,
  ExceptionStatus,
  ExceptionSeverity,
} from "@/lib/types";

// ============================================================================
// MONTH CLOSE SELECTORS
// ============================================================================

export interface MonthCloseState {
  readonly id: string;
  readonly status: MonthCloseStatus;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: "EUR";
  readonly isFinalized: boolean;
  readonly canSubmitForReview: boolean;
  readonly canReturnToDraft: boolean;
  readonly canFinalize: boolean;
}

export function selectMonthCloseState(
  doc: {
    id: string;
    status: MonthCloseStatus;
    periodStart: Date;
    periodEnd: Date;
    currency: "EUR";
  },
  openExceptionsCount: number,
  highExceptionsCount: number
): MonthCloseState {
  const isFinalized = doc.status === MonthCloseStatus.FINALIZED;
  const isDraft = doc.status === MonthCloseStatus.DRAFT;
  const isInReview = doc.status === MonthCloseStatus.IN_REVIEW;

  return {
    id: doc.id,
    status: doc.status,
    periodStart: doc.periodStart,
    periodEnd: doc.periodEnd,
    currency: doc.currency,
    isFinalized,
    canSubmitForReview: isDraft,
    canReturnToDraft: isInReview,
    canFinalize: isInReview && openExceptionsCount === 0 && highExceptionsCount === 0,
  };
}

// ============================================================================
// FILE ASSET SELECTORS
// ============================================================================

export interface FileAssetState {
  readonly id: string;
  readonly filename: string;
  readonly status: FileAssetStatus;
  readonly parseStatus: ParseStatus;
  readonly kind: string;
  readonly isUploaded: boolean;
  readonly isParsed: boolean;
  readonly isDeleted: boolean;
  readonly canParse: boolean;
  readonly canRetryParse: boolean;
}

export function selectFileAssetState(doc: {
  id: string;
  filename: string;
  status: FileAssetStatus;
  parseStatus?: ParseStatus;
  kind: string;
}): FileAssetState {
  const parseStatus = doc.parseStatus ?? ParseStatus.PENDING;
  const isUploaded = doc.status === FileAssetStatus.UPLOADED || doc.status === FileAssetStatus.VERIFIED;
  const isParsed = parseStatus === ParseStatus.PARSED;
  const isDeleted = doc.status === FileAssetStatus.DELETED;

  return {
    id: doc.id,
    filename: doc.filename,
    status: doc.status,
    parseStatus,
    kind: doc.kind,
    isUploaded,
    isParsed,
    isDeleted,
    canParse: isUploaded && parseStatus === ParseStatus.PENDING,
    canRetryParse: isUploaded && parseStatus === ParseStatus.FAILED,
  };
}

// ============================================================================
// MATCH SELECTORS
// ============================================================================

export interface MatchState {
  readonly id: string;
  readonly status: MatchStatus;
  readonly confidence: number;
  readonly isConfirmed: boolean;
  readonly isRejected: boolean;
  readonly isProposed: boolean;
  readonly canConfirm: boolean;
  readonly canReject: boolean;
  readonly confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
}

export function selectMatchState(doc: {
  id: string;
  status: MatchStatus;
  confidence: number;
}): MatchState {
  const isConfirmed = doc.status === MatchStatus.CONFIRMED;
  const isRejected = doc.status === MatchStatus.REJECTED;
  const isProposed = doc.status === MatchStatus.PROPOSED;

  let confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  if (doc.confidence >= 0.9) {
    confidenceLevel = "HIGH";
  } else if (doc.confidence >= 0.7) {
    confidenceLevel = "MEDIUM";
  } else {
    confidenceLevel = "LOW";
  }

  return {
    id: doc.id,
    status: doc.status,
    confidence: doc.confidence,
    isConfirmed,
    isRejected,
    isProposed,
    canConfirm: isProposed,
    canReject: isProposed,
    confidenceLevel,
  };
}

// ============================================================================
// EXCEPTION SELECTORS
// ============================================================================

export interface ExceptionSummary {
  readonly totalCount: number;
  readonly openCount: number;
  readonly resolvedCount: number;
  readonly highPriorityCount: number;
  readonly mediumPriorityCount: number;
  readonly lowPriorityCount: number;
  readonly hasBlockingExceptions: boolean;
}

export function selectExceptionSummary(
  exceptions: readonly {
    status: ExceptionStatus;
    severity: ExceptionSeverity;
  }[]
): ExceptionSummary {
  let openCount = 0;
  let resolvedCount = 0;
  let highPriorityCount = 0;
  let mediumPriorityCount = 0;
  let lowPriorityCount = 0;

  for (const ex of exceptions) {
    if (ex.status === ExceptionStatus.OPEN) {
      openCount++;
      if (ex.severity === ExceptionSeverity.HIGH) {
        highPriorityCount++;
      } else if (ex.severity === ExceptionSeverity.MEDIUM) {
        mediumPriorityCount++;
      } else {
        lowPriorityCount++;
      }
    } else {
      resolvedCount++;
    }
  }

  return {
    totalCount: exceptions.length,
    openCount,
    resolvedCount,
    highPriorityCount,
    mediumPriorityCount,
    lowPriorityCount,
    hasBlockingExceptions: highPriorityCount > 0 || openCount > 0,
  };
}

// ============================================================================
// RECONCILIATION SELECTORS
// ============================================================================

export interface ReconciliationState {
  readonly bankTotal: number;
  readonly invoiceTotal: number;
  readonly difference: number;
  readonly matchedBankCount: number;
  readonly matchedInvoiceCount: number;
  readonly unmatchedBankCount: number;
  readonly unmatchedInvoiceCount: number;
  readonly matchedBankTotal: number;
  readonly matchedInvoiceTotal: number;
  readonly matchPercentage: number;
  readonly isReconciled: boolean;
  readonly isWithinTolerance: boolean;
}

export function selectReconciliationState(data: {
  bankTotal: number;
  invoiceTotal: number;
  matchedBankCount: number;
  matchedInvoiceCount: number;
  unmatchedBankCount: number;
  unmatchedInvoiceCount: number;
  matchedBankTotal: number;
  matchedInvoiceTotal: number;
  toleranceCents?: number;
}): ReconciliationState {
  const difference = data.bankTotal - data.invoiceTotal;
  const totalBankItems = data.matchedBankCount + data.unmatchedBankCount;
  const matchPercentage = totalBankItems > 0
    ? (data.matchedBankCount / totalBankItems) * 100
    : 0;

  const toleranceCents = data.toleranceCents ?? 100; // Default 1€ tolerance
  const isWithinTolerance = Math.abs(difference) <= toleranceCents;

  return {
    bankTotal: data.bankTotal,
    invoiceTotal: data.invoiceTotal,
    difference,
    matchedBankCount: data.matchedBankCount,
    matchedInvoiceCount: data.matchedInvoiceCount,
    unmatchedBankCount: data.unmatchedBankCount,
    unmatchedInvoiceCount: data.unmatchedInvoiceCount,
    matchedBankTotal: data.matchedBankTotal,
    matchedInvoiceTotal: data.matchedInvoiceTotal,
    matchPercentage,
    isReconciled: difference === 0,
    isWithinTolerance,
  };
}

// ============================================================================
// FLOW STATE SELECTORS
// ============================================================================

export type FlowPhase =
  | "UPLOAD"          // Need to upload files
  | "PARSE"           // Need to parse files
  | "MATCH"           // Need to run matching
  | "REVIEW"          // Need to review matches
  | "RESOLVE"         // Need to resolve exceptions
  | "FINALIZE"        // Ready to finalize
  | "COMPLETE";       // Finalized

export interface FlowState {
  readonly phase: FlowPhase;
  readonly progress: number; // 0-100
  readonly nextAction: string;
  readonly blockers: readonly string[];
}

export function selectFlowState(
  monthCloseStatus: MonthCloseStatus,
  filesCount: number,
  parsedFilesCount: number,
  proposedMatchesCount: number,
  confirmedMatchesCount: number,
  openExceptionsCount: number
): FlowState {
  // If finalized, we're complete
  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return {
      phase: "COMPLETE",
      progress: 100,
      nextAction: "View summary or start new month",
      blockers: [],
    };
  }

  // Calculate which phase we're in
  if (filesCount === 0) {
    return {
      phase: "UPLOAD",
      progress: 0,
      nextAction: "Upload bank statements and invoices",
      blockers: [],
    };
  }

  if (parsedFilesCount < filesCount) {
    return {
      phase: "PARSE",
      progress: 15,
      nextAction: "Parse uploaded files to extract data",
      blockers: [],
    };
  }

  if (proposedMatchesCount === 0 && confirmedMatchesCount === 0) {
    return {
      phase: "MATCH",
      progress: 30,
      nextAction: "Run matching to find invoice-transaction links",
      blockers: [],
    };
  }

  if (proposedMatchesCount > 0) {
    return {
      phase: "REVIEW",
      progress: 50,
      nextAction: `Review and confirm ${proposedMatchesCount} proposed matches`,
      blockers: [],
    };
  }

  if (openExceptionsCount > 0) {
    return {
      phase: "RESOLVE",
      progress: 70,
      nextAction: `Resolve ${openExceptionsCount} open exceptions`,
      blockers: [`${openExceptionsCount} unresolved exceptions`],
    };
  }

  if (monthCloseStatus === MonthCloseStatus.DRAFT) {
    return {
      phase: "FINALIZE",
      progress: 85,
      nextAction: "Submit for review",
      blockers: [],
    };
  }

  if (monthCloseStatus === MonthCloseStatus.IN_REVIEW) {
    return {
      phase: "FINALIZE",
      progress: 95,
      nextAction: "Finalize month close",
      blockers: [],
    };
  }

  // Fallback
  return {
    phase: "UPLOAD",
    progress: 0,
    nextAction: "Upload files to get started",
    blockers: [],
  };
}
