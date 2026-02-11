/**
 * Month Close Summary Card - Read model for UI display
 * Pure projection logic. No IO, no randomness, no time.
 *
 * INVARIANT: Read model is derived, not authoritative
 * INVARIANT: Same inputs always produce same output
 * INVARIANT: Can be deleted and rebuilt from source data
 *
 * @module readmodels/monthCloseSummaryCard
 */

import { Amount, amountFromCents, CurrencyCode } from "../domain/money";
import { Result, ok, err } from "../logic/errors/normalizeError";
import {
  BusinessErrorCode,
  createBusinessError,
} from "../logic/errors/businessErrors";

// ============================================================================
// INPUT TYPES (Source of Truth)
// ============================================================================

/**
 * Month close source data (from Firestore monthCloses collection)
 */
export interface MonthCloseSource {
  readonly id: string;
  readonly tenantId: string;
  readonly periodStart: string; // YYYY-MM-DD
  readonly periodEnd: string; // YYYY-MM-DD
  readonly status: "DRAFT" | "IN_REVIEW" | "FINALIZED";
  readonly bankTotal: number; // Decimal
  readonly invoiceTotal: number; // Decimal
  readonly diff: number; // Decimal
  readonly openExceptionsCount: number;
  readonly highExceptionsCount: number;
  readonly currency: CurrencyCode;
  readonly notes?: string;
  readonly finalizedAt?: string; // ISO timestamp
}

/**
 * Additional context for enrichment
 */
export interface MonthCloseContext {
  readonly totalTransactions: number;
  readonly totalInvoices: number;
  readonly confirmedMatches: number;
  readonly proposedMatches: number;
  readonly rejectedMatches: number;
  readonly averageMatchScore: number;
  readonly lastActivityAt?: string; // ISO timestamp
}

// ============================================================================
// OUTPUT TYPES (Read Model)
// ============================================================================

/**
 * Health status indicator
 */
export type HealthStatus = "HEALTHY" | "WARNING" | "CRITICAL" | "UNKNOWN";

/**
 * Progress stage for UI
 */
export type ProgressStage =
  | "NOT_STARTED"
  | "IMPORTING"
  | "MATCHING"
  | "REVIEWING"
  | "FINALIZING"
  | "COMPLETE";

/**
 * Action button state
 */
export interface ActionButton {
  readonly id: string;
  readonly label: string;
  readonly action: string;
  readonly enabled: boolean;
  readonly variant: "primary" | "secondary" | "danger";
  readonly tooltip?: string;
}

/**
 * Summary card for month close display
 */
export interface MonthCloseSummaryCard {
  readonly id: string;
  readonly tenantId: string;

  // Period info
  readonly periodLabel: string; // e.g., "January 2026"
  readonly periodStart: string;
  readonly periodEnd: string;

  // Status
  readonly status: "DRAFT" | "IN_REVIEW" | "FINALIZED";
  readonly statusLabel: string;
  readonly statusColor: "gray" | "yellow" | "green";

  // Health
  readonly healthStatus: HealthStatus;
  readonly healthLabel: string;
  readonly healthColor: "green" | "yellow" | "red" | "gray";

  // Progress
  readonly progressStage: ProgressStage;
  readonly progressPercent: number;
  readonly progressLabel: string;

  // Financial summary
  readonly bankTotal: Amount;
  readonly invoiceTotal: Amount;
  readonly difference: Amount;
  readonly isBalanced: boolean;
  readonly differenceLabel: string;
  readonly differenceColor: "green" | "yellow" | "red";

  // Counts
  readonly transactionCount: number;
  readonly invoiceCount: number;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
  readonly exceptionCount: number;
  readonly highPriorityExceptionCount: number;

  // Percentages
  readonly matchPercent: number;
  readonly completionPercent: number;

  // Quality metrics
  readonly averageMatchScore: number;
  readonly dataQualityScore: number;

  // Actions
  readonly actions: readonly ActionButton[];

  // Flags
  readonly canTransitionToReview: boolean;
  readonly canFinalize: boolean;
  readonly hasBlockingIssues: boolean;
  readonly blockingIssues: readonly string[];

  // Timestamps
  readonly lastActivityAt?: string;
  readonly finalizedAt?: string;

  // Notes
  readonly notes?: string;
}

// ============================================================================
// PROJECTION FUNCTION
// ============================================================================

/**
 * Projects month close source data to a summary card
 *
 * @param source - Month close source data
 * @param context - Additional context for enrichment
 * @returns Result with summary card or error
 */
export function projectMonthCloseSummaryCard(
  source: MonthCloseSource,
  context: MonthCloseContext
): Result<MonthCloseSummaryCard> {
  // Validate required fields
  if (!source.id || !source.tenantId) {
    return err(
      createBusinessError(BusinessErrorCode.MISSING_REQUIRED_FIELD, {
        message: "MonthClose source must have id and tenantId",
      })
    );
  }

  if (!isValidDateFormat(source.periodStart) || !isValidDateFormat(source.periodEnd)) {
    return err(
      createBusinessError(BusinessErrorCode.INVALID_DATE_FORMAT, {
        message: "Period dates must be in YYYY-MM-DD format",
        details: {
          periodStart: source.periodStart,
          periodEnd: source.periodEnd,
        },
      })
    );
  }

  // Convert to cents
  const bankTotalCents = decimalToCents(source.bankTotal);
  const invoiceTotalCents = decimalToCents(source.invoiceTotal);
  const diffCents = decimalToCents(source.diff);

  const bankTotal = amountFromCents(bankTotalCents, source.currency);
  const invoiceTotal = amountFromCents(invoiceTotalCents, source.currency);
  const difference = amountFromCents(diffCents, source.currency);

  // Calculate derived values
  const isBalanced = Math.abs(diffCents) <= 100; // 1.00 tolerance
  const totalItems = context.totalTransactions + context.totalInvoices;
  const matchedCount = context.confirmedMatches;
  const unmatchedCount = totalItems - matchedCount * 2; // Each match covers 2 items
  const matchPercent =
    totalItems > 0 ? Math.round((matchedCount * 2 * 100) / totalItems) : 0;

  // Health status
  const healthStatus = calculateHealthStatus(
    source.openExceptionsCount,
    source.highExceptionsCount,
    Math.abs(diffCents),
    matchPercent
  );

  // Progress
  const progressStage = calculateProgressStage(
    source.status,
    context.totalTransactions,
    context.totalInvoices,
    matchedCount
  );
  const progressPercent = calculateProgressPercent(
    source.status,
    matchPercent,
    source.openExceptionsCount
  );

  // Data quality score
  const dataQualityScore = calculateDataQualityScore(
    context.averageMatchScore,
    matchPercent,
    source.highExceptionsCount
  );

  // Status labels and colors
  const statusLabel = getStatusLabel(source.status);
  const statusColor = getStatusColor(source.status);
  const healthLabel = getHealthLabel(healthStatus);
  const healthColor = getHealthColor(healthStatus);
  const differenceLabel = formatDifferenceLabel(diffCents, source.currency);
  const differenceColor = getDifferenceColor(diffCents);

  // Actions
  const actions = calculateActions(
    source.status,
    matchPercent,
    source.openExceptionsCount,
    source.highExceptionsCount
  );

  // Blocking issues
  const blockingIssues = identifyBlockingIssues(
    source.status,
    Math.abs(diffCents),
    source.openExceptionsCount,
    source.highExceptionsCount,
    matchPercent
  );

  // Period label
  const periodLabel = formatPeriodLabel(source.periodStart);

  // Completion percent
  const completionPercent =
    source.status === "FINALIZED"
      ? 100
      : Math.min(95, Math.round(matchPercent * 0.7 + dataQualityScore * 0.3));

  return ok({
    id: source.id,
    tenantId: source.tenantId,

    // Period
    periodLabel,
    periodStart: source.periodStart,
    periodEnd: source.periodEnd,

    // Status
    status: source.status,
    statusLabel,
    statusColor,

    // Health
    healthStatus,
    healthLabel,
    healthColor,

    // Progress
    progressStage,
    progressPercent,
    progressLabel: `${progressPercent}% complete`,

    // Financial
    bankTotal,
    invoiceTotal,
    difference,
    isBalanced,
    differenceLabel,
    differenceColor,

    // Counts
    transactionCount: context.totalTransactions,
    invoiceCount: context.totalInvoices,
    matchedCount,
    unmatchedCount: Math.max(0, unmatchedCount),
    exceptionCount: source.openExceptionsCount,
    highPriorityExceptionCount: source.highExceptionsCount,

    // Percentages
    matchPercent,
    completionPercent,

    // Quality
    averageMatchScore: context.averageMatchScore,
    dataQualityScore,

    // Actions
    actions,

    // Flags
    canTransitionToReview: matchPercent >= 50 && source.status === "DRAFT",
    canFinalize:
      source.status === "IN_REVIEW" &&
      blockingIssues.length === 0 &&
      matchPercent >= 90,
    hasBlockingIssues: blockingIssues.length > 0,
    blockingIssues,

    // Timestamps
    lastActivityAt: context.lastActivityAt,
    finalizedAt: source.finalizedAt,

    // Notes
    notes: source.notes,
  });
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

function calculateHealthStatus(
  openExceptions: number,
  highExceptions: number,
  absDiffCents: number,
  matchPercent: number
): HealthStatus {
  if (highExceptions > 5 || absDiffCents > 100000) {
    return "CRITICAL";
  }
  if (highExceptions > 0 || openExceptions > 10 || matchPercent < 50) {
    return "WARNING";
  }
  if (matchPercent >= 90 && openExceptions === 0) {
    return "HEALTHY";
  }
  return "UNKNOWN";
}

function calculateProgressStage(
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED",
  txCount: number,
  invCount: number,
  matchedCount: number
): ProgressStage {
  if (status === "FINALIZED") return "COMPLETE";
  if (status === "IN_REVIEW") return "REVIEWING";

  const totalItems = txCount + invCount;
  if (totalItems === 0) return "NOT_STARTED";
  if (matchedCount === 0) return "IMPORTING";
  if (matchedCount * 2 < totalItems * 0.9) return "MATCHING";
  return "FINALIZING";
}

function calculateProgressPercent(
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED",
  matchPercent: number,
  openExceptions: number
): number {
  if (status === "FINALIZED") return 100;

  // Base progress from match percent
  let progress = Math.min(80, matchPercent * 0.8);

  // Deduct for open exceptions
  progress -= Math.min(20, openExceptions * 2);

  // Add for review status
  if (status === "IN_REVIEW") {
    progress = Math.max(progress, 70);
  }

  return Math.max(0, Math.round(progress));
}

function calculateDataQualityScore(
  avgMatchScore: number,
  matchPercent: number,
  highExceptions: number
): number {
  const baseScore = (avgMatchScore + matchPercent) / 2;
  const penalty = highExceptions * 5;
  return Math.max(0, Math.min(100, Math.round(baseScore - penalty)));
}

// ============================================================================
// LABEL HELPERS
// ============================================================================

function getStatusLabel(status: "DRAFT" | "IN_REVIEW" | "FINALIZED"): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "IN_REVIEW":
      return "In Review";
    case "FINALIZED":
      return "Finalized";
  }
}

function getStatusColor(
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED"
): "gray" | "yellow" | "green" {
  switch (status) {
    case "DRAFT":
      return "gray";
    case "IN_REVIEW":
      return "yellow";
    case "FINALIZED":
      return "green";
  }
}

function getHealthLabel(health: HealthStatus): string {
  switch (health) {
    case "HEALTHY":
      return "Healthy";
    case "WARNING":
      return "Needs Attention";
    case "CRITICAL":
      return "Critical Issues";
    case "UNKNOWN":
      return "Unknown";
  }
}

function getHealthColor(
  health: HealthStatus
): "green" | "yellow" | "red" | "gray" {
  switch (health) {
    case "HEALTHY":
      return "green";
    case "WARNING":
      return "yellow";
    case "CRITICAL":
      return "red";
    case "UNKNOWN":
      return "gray";
  }
}

function formatDifferenceLabel(diffCents: number, currency: CurrencyCode): string {
  const absValue = Math.abs(diffCents) / 100;
  const formatted = absValue.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (diffCents === 0) return "Balanced";
  if (diffCents > 0) return `+${formatted} bank excess`;
  return `-${formatted} invoice excess`;
}

function getDifferenceColor(diffCents: number): "green" | "yellow" | "red" {
  const abs = Math.abs(diffCents);
  if (abs <= 100) return "green"; // 1.00 tolerance
  if (abs <= 10000) return "yellow"; // 100.00 warning
  return "red";
}

function formatPeriodLabel(periodStart: string): string {
  const date = new Date(periodStart + "T00:00:00Z");
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

// ============================================================================
// ACTION HELPERS
// ============================================================================

function calculateActions(
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED",
  matchPercent: number,
  openExceptions: number,
  highExceptions: number
): readonly ActionButton[] {
  const actions: ActionButton[] = [];

  switch (status) {
    case "DRAFT":
      actions.push({
        id: "import",
        label: "Import Files",
        action: "IMPORT_FILES",
        enabled: true,
        variant: "secondary",
      });
      actions.push({
        id: "review",
        label: "Submit for Review",
        action: "SUBMIT_REVIEW",
        enabled: matchPercent >= 50,
        variant: "primary",
        tooltip:
          matchPercent < 50
            ? "At least 50% match rate required"
            : undefined,
      });
      break;

    case "IN_REVIEW":
      actions.push({
        id: "resolve",
        label: "Resolve Exceptions",
        action: "RESOLVE_EXCEPTIONS",
        enabled: openExceptions > 0,
        variant: "secondary",
      });
      actions.push({
        id: "finalize",
        label: "Finalize",
        action: "FINALIZE",
        enabled: highExceptions === 0 && matchPercent >= 90,
        variant: "primary",
        tooltip:
          highExceptions > 0
            ? "Resolve high priority exceptions first"
            : matchPercent < 90
              ? "At least 90% match rate required"
              : undefined,
      });
      actions.push({
        id: "revert",
        label: "Return to Draft",
        action: "REVERT_DRAFT",
        enabled: true,
        variant: "danger",
      });
      break;

    case "FINALIZED":
      actions.push({
        id: "export",
        label: "Export Report",
        action: "EXPORT_REPORT",
        enabled: true,
        variant: "primary",
      });
      actions.push({
        id: "view",
        label: "View Details",
        action: "VIEW_DETAILS",
        enabled: true,
        variant: "secondary",
      });
      break;
  }

  return actions;
}

function identifyBlockingIssues(
  status: "DRAFT" | "IN_REVIEW" | "FINALIZED",
  absDiffCents: number,
  openExceptions: number,
  highExceptions: number,
  matchPercent: number
): readonly string[] {
  if (status === "FINALIZED") return [];

  const issues: string[] = [];

  if (highExceptions > 0) {
    issues.push(`${highExceptions} high priority exception(s) require resolution`);
  }

  if (absDiffCents > 10000) {
    // More than 100.00 difference
    const diffDisplay = (absDiffCents / 100).toFixed(2);
    issues.push(`Balance difference (${diffDisplay}) exceeds acceptable threshold`);
  }

  if (status === "IN_REVIEW" && matchPercent < 90) {
    issues.push(`Match rate (${matchPercent}%) below 90% finalization threshold`);
  }

  if (status === "DRAFT" && matchPercent < 50) {
    issues.push(`Match rate (${matchPercent}%) below 50% review threshold`);
  }

  return issues;
}

// ============================================================================
// UTILITY HELPERS
// ============================================================================

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function decimalToCents(decimal: number): number {
  return Math.round(decimal * 100);
}

// ============================================================================
// BATCH PROJECTION
// ============================================================================

/**
 * Projects multiple month closes to summary cards
 *
 * @param sources - Array of month close sources with contexts
 * @returns Array of results (success or error for each)
 */
export function projectMonthCloseSummaryCards(
  sources: readonly { source: MonthCloseSource; context: MonthCloseContext }[]
): readonly Result<MonthCloseSummaryCard>[] {
  return sources.map(({ source, context }) =>
    projectMonthCloseSummaryCard(source, context)
  );
}

/**
 * Filters and sorts summary cards for display
 *
 * @param cards - Array of summary cards
 * @param options - Sort and filter options
 * @returns Sorted and filtered array
 */
export function sortSummaryCards(
  cards: readonly MonthCloseSummaryCard[],
  options: {
    sortBy: "period" | "status" | "health" | "matchPercent";
    sortOrder: "asc" | "desc";
    statusFilter?: ("DRAFT" | "IN_REVIEW" | "FINALIZED")[];
  }
): readonly MonthCloseSummaryCard[] {
  let filtered = [...cards];

  // Apply status filter
  if (options.statusFilter && options.statusFilter.length > 0) {
    filtered = filtered.filter((c) => options.statusFilter!.includes(c.status));
  }

  // Sort
  const multiplier = options.sortOrder === "asc" ? 1 : -1;

  filtered.sort((a, b) => {
    switch (options.sortBy) {
      case "period":
        return a.periodStart.localeCompare(b.periodStart) * multiplier;
      case "status":
        const statusOrder = { DRAFT: 0, IN_REVIEW: 1, FINALIZED: 2 };
        return (statusOrder[a.status] - statusOrder[b.status]) * multiplier;
      case "health":
        const healthOrder = { CRITICAL: 0, WARNING: 1, UNKNOWN: 2, HEALTHY: 3 };
        return (
          (healthOrder[a.healthStatus] - healthOrder[b.healthStatus]) *
          multiplier
        );
      case "matchPercent":
        return (a.matchPercent - b.matchPercent) * multiplier;
      default:
        return 0;
    }
  });

  return filtered;
}
