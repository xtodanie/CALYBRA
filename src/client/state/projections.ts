/**
 * State Projections - Read-only views of system state
 *
 * Projections provide:
 * - Computed views from raw Firestore data
 * - UI-ready data structures
 * - Aggregations and summaries
 *
 * INVARIANT: Projections never mutate source data
 * INVARIANT: Projections are recomputable from source
 */

import { MonthCloseStatus, MatchStatus, MatchType, ExceptionKind, ExceptionSeverity } from "@/lib/types";

// ============================================================================
// MATCH LIST PROJECTION
// ============================================================================

export interface MatchListItem {
  readonly id: string;
  readonly status: MatchStatus;
  readonly matchType: MatchType;
  readonly confidence: number;
  readonly confidenceLabel: string;
  readonly bankTx: {
    readonly id: string;
    readonly amount: number;
    readonly date: string;
    readonly description: string;
  };
  readonly invoice: {
    readonly id: string;
    readonly amount: number;
    readonly invoiceNumber: string;
    readonly supplierName: string;
  };
  readonly difference: number;
  readonly differencePercent: number;
}

export function projectMatchList(
  matches: readonly {
    id: string;
    status: MatchStatus;
    matchType: MatchType;
    confidence: number;
    bankTxId: string;
    invoiceId: string;
  }[],
  bankTxMap: Map<string, { amount: number; date: string; description: string }>,
  invoiceMap: Map<string, { amount: number; invoiceNumber: string; supplierName: string }>
): MatchListItem[] {
  return matches.map((match) => {
    const bankTx = bankTxMap.get(match.bankTxId);
    const invoice = invoiceMap.get(match.invoiceId);

    const bankAmount = bankTx?.amount ?? 0;
    const invoiceAmount = invoice?.amount ?? 0;
    const difference = bankAmount - invoiceAmount;
    const differencePercent = invoiceAmount !== 0 
      ? (difference / invoiceAmount) * 100 
      : 0;

    let confidenceLabel: string;
    if (match.confidence >= 0.95) {
      confidenceLabel = "Very High";
    } else if (match.confidence >= 0.85) {
      confidenceLabel = "High";
    } else if (match.confidence >= 0.7) {
      confidenceLabel = "Medium";
    } else if (match.confidence >= 0.5) {
      confidenceLabel = "Low";
    } else {
      confidenceLabel = "Very Low";
    }

    return {
      id: match.id,
      status: match.status,
      matchType: match.matchType,
      confidence: match.confidence,
      confidenceLabel,
      bankTx: {
        id: match.bankTxId,
        amount: bankAmount,
        date: bankTx?.date ?? "",
        description: bankTx?.description ?? "",
      },
      invoice: {
        id: match.invoiceId,
        amount: invoiceAmount,
        invoiceNumber: invoice?.invoiceNumber ?? "",
        supplierName: invoice?.supplierName ?? "",
      },
      difference,
      differencePercent,
    };
  });
}

// ============================================================================
// MONTH CLOSE SUMMARY PROJECTION
// ============================================================================

export interface MonthCloseSummary {
  readonly id: string;
  readonly status: MonthCloseStatus;
  readonly statusLabel: string;
  readonly period: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: string;
  
  // Counts
  readonly bankTxCount: number;
  readonly invoiceCount: number;
  readonly matchedCount: number;
  readonly unmatchedBankCount: number;
  readonly unmatchedInvoiceCount: number;
  readonly openExceptionsCount: number;
  
  // Totals (in cents)
  readonly bankTotal: number;
  readonly invoiceTotal: number;
  readonly matchedTotal: number;
  readonly unmatchedBankTotal: number;
  readonly unmatchedInvoiceTotal: number;
  readonly difference: number;
  
  // Percentages
  readonly matchPercentage: number;
  readonly reconciliationProgress: number;
  
  // Formatted for display
  readonly bankTotalFormatted: string;
  readonly invoiceTotalFormatted: string;
  readonly differenceFormatted: string;
}

export function projectMonthCloseSummary(
  monthClose: {
    id: string;
    status: MonthCloseStatus;
    periodStart: Date;
    periodEnd: Date;
    currency: string;
  },
  aggregates: {
    bankTxCount: number;
    invoiceCount: number;
    matchedCount: number;
    unmatchedBankCount: number;
    unmatchedInvoiceCount: number;
    openExceptionsCount: number;
    bankTotal: number;
    invoiceTotal: number;
    matchedTotal: number;
    unmatchedBankTotal: number;
    unmatchedInvoiceTotal: number;
  }
): MonthCloseSummary {
  const statusLabels: Record<MonthCloseStatus, string> = {
    [MonthCloseStatus.DRAFT]: "Draft",
    [MonthCloseStatus.IN_REVIEW]: "In Review",
    [MonthCloseStatus.FINALIZED]: "Finalized",
  };

  const difference = aggregates.bankTotal - aggregates.invoiceTotal;
  const totalItems = aggregates.bankTxCount + aggregates.invoiceCount;
  const matchedItems = aggregates.matchedCount * 2; // Each match links 2 items
  const matchPercentage = totalItems > 0 ? (matchedItems / totalItems) * 100 : 0;
  
  // Reconciliation progress based on workflow steps
  let reconciliationProgress = 0;
  if (aggregates.bankTxCount > 0 || aggregates.invoiceCount > 0) {
    reconciliationProgress = 20; // Have data
  }
  if (aggregates.matchedCount > 0) {
    reconciliationProgress = 40 + (matchPercentage * 0.4); // Matching progress
  }
  if (aggregates.openExceptionsCount === 0 && aggregates.matchedCount > 0) {
    reconciliationProgress = 90; // Ready to finalize
  }
  if (monthClose.status === MonthCloseStatus.FINALIZED) {
    reconciliationProgress = 100;
  }

  // Format currency
  const formatCurrency = (cents: number): string => {
    const euros = cents / 100;
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: monthClose.currency,
    }).format(euros);
  };

  // Format period
  const periodFormat = new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "long" });
  const period = periodFormat.format(monthClose.periodStart);

  return {
    id: monthClose.id,
    status: monthClose.status,
    statusLabel: statusLabels[monthClose.status],
    period,
    periodStart: monthClose.periodStart,
    periodEnd: monthClose.periodEnd,
    currency: monthClose.currency,
    
    bankTxCount: aggregates.bankTxCount,
    invoiceCount: aggregates.invoiceCount,
    matchedCount: aggregates.matchedCount,
    unmatchedBankCount: aggregates.unmatchedBankCount,
    unmatchedInvoiceCount: aggregates.unmatchedInvoiceCount,
    openExceptionsCount: aggregates.openExceptionsCount,
    
    bankTotal: aggregates.bankTotal,
    invoiceTotal: aggregates.invoiceTotal,
    matchedTotal: aggregates.matchedTotal,
    unmatchedBankTotal: aggregates.unmatchedBankTotal,
    unmatchedInvoiceTotal: aggregates.unmatchedInvoiceTotal,
    difference,
    
    matchPercentage,
    reconciliationProgress,
    
    bankTotalFormatted: formatCurrency(aggregates.bankTotal),
    invoiceTotalFormatted: formatCurrency(aggregates.invoiceTotal),
    differenceFormatted: formatCurrency(difference),
  };
}

// ============================================================================
// EXCEPTION LIST PROJECTION
// ============================================================================

export interface ExceptionListItem {
  readonly id: string;
  readonly kind: ExceptionKind;
  readonly kindLabel: string;
  readonly severity: ExceptionSeverity;
  readonly severityLabel: string;
  readonly description: string;
  readonly relatedBankTxId?: string;
  readonly relatedInvoiceId?: string;
  readonly canResolve: boolean;
  readonly suggestedAction: string;
}

const EXCEPTION_KIND_LABELS: Record<ExceptionKind, string> = {
  [ExceptionKind.BANK_NO_INVOICE]: "Bank transaction without invoice",
  [ExceptionKind.INVOICE_NO_BANK]: "Invoice without bank transaction",
  [ExceptionKind.AMOUNT_MISMATCH]: "Amount mismatch",
  [ExceptionKind.DUPLICATE]: "Duplicate detected",
  [ExceptionKind.AMBIGUOUS]: "Ambiguous match",
  [ExceptionKind.UNKNOWN_SUPPLIER]: "Unknown supplier",
};

const EXCEPTION_SEVERITY_LABELS: Record<ExceptionSeverity, string> = {
  [ExceptionSeverity.HIGH]: "High Priority",
  [ExceptionSeverity.MEDIUM]: "Medium Priority",
  [ExceptionSeverity.LOW]: "Low Priority",
};

const EXCEPTION_SUGGESTED_ACTIONS: Record<ExceptionKind, string> = {
  [ExceptionKind.BANK_NO_INVOICE]: "Upload the missing invoice or mark as non-invoice transaction",
  [ExceptionKind.INVOICE_NO_BANK]: "Verify if payment was received or mark as unpaid",
  [ExceptionKind.AMOUNT_MISMATCH]: "Review amounts and confirm if difference is acceptable",
  [ExceptionKind.DUPLICATE]: "Remove duplicate entry or confirm both are valid",
  [ExceptionKind.AMBIGUOUS]: "Manually select the correct match",
  [ExceptionKind.UNKNOWN_SUPPLIER]: "Add supplier to known list or verify invoice",
};

export function projectExceptionList(
  exceptions: readonly {
    id: string;
    kind: ExceptionKind;
    severity: ExceptionSeverity;
    description?: string;
    bankTxId?: string;
    invoiceId?: string;
    status: string;
  }[]
): ExceptionListItem[] {
  return exceptions.map((ex) => ({
    id: ex.id,
    kind: ex.kind,
    kindLabel: EXCEPTION_KIND_LABELS[ex.kind],
    severity: ex.severity,
    severityLabel: EXCEPTION_SEVERITY_LABELS[ex.severity],
    description: ex.description ?? EXCEPTION_KIND_LABELS[ex.kind],
    relatedBankTxId: ex.bankTxId,
    relatedInvoiceId: ex.invoiceId,
    canResolve: ex.status === "OPEN",
    suggestedAction: EXCEPTION_SUGGESTED_ACTIONS[ex.kind],
  }));
}

// ============================================================================
// FILE LIST PROJECTION
// ============================================================================

export interface FileListItem {
  readonly id: string;
  readonly filename: string;
  readonly kind: string;
  readonly kindLabel: string;
  readonly status: string;
  readonly statusLabel: string;
  readonly parseStatus: string;
  readonly parseStatusLabel: string;
  readonly uploadedAt: Date;
  readonly size?: number;
  readonly sizeFormatted?: string;
  readonly extractedCount?: number;
  readonly canParse: boolean;
  readonly canDelete: boolean;
}

export function projectFileList(
  files: readonly {
    id: string;
    filename: string;
    kind: string;
    status: string;
    parseStatus?: string;
    createdAt: Date;
    size?: number;
    extractedCount?: number;
  }[]
): FileListItem[] {
  const kindLabels: Record<string, string> = {
    BANK_CSV: "Bank Statement",
    INVOICE_PDF: "Invoice",
    EXPORT: "Export",
  };

  const statusLabels: Record<string, string> = {
    PENDING_UPLOAD: "Uploading...",
    UPLOADED: "Uploaded",
    VERIFIED: "Verified",
    REJECTED: "Rejected",
    DELETED: "Deleted",
  };

  const parseStatusLabels: Record<string, string> = {
    PENDING: "Not parsed",
    PARSED: "Parsed",
    FAILED: "Parse failed",
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return files.map((file) => {
    const parseStatus = file.parseStatus ?? "PENDING";
    const isUploaded = file.status === "UPLOADED" || file.status === "VERIFIED";
    const isNotDeleted = file.status !== "DELETED";

    return {
      id: file.id,
      filename: file.filename,
      kind: file.kind,
      kindLabel: kindLabels[file.kind] ?? file.kind,
      status: file.status,
      statusLabel: statusLabels[file.status] ?? file.status,
      parseStatus,
      parseStatusLabel: parseStatusLabels[parseStatus] ?? parseStatus,
      uploadedAt: file.createdAt,
      size: file.size,
      sizeFormatted: file.size ? formatSize(file.size) : undefined,
      extractedCount: file.extractedCount,
      canParse: isUploaded && parseStatus === "PENDING",
      canDelete: isNotDeleted,
    };
  });
}
