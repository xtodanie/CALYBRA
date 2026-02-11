/**
 * Explanations - Human-readable system state explanations
 *
 * This module provides clear, actionable explanations for:
 * - Current system state
 * - What happened
 * - Why it happened
 * - What the user can do next
 *
 * INVARIANT: Every explanation is deterministic
 * INVARIANT: Users always know what happened and what they can do
 */

import { MonthCloseStatus, MatchStatus, FileAssetStatus, ParseStatus } from "@/lib/types";

// ============================================================================
// STATUS EXPLANATIONS
// ============================================================================

export interface StatusExplanation {
  readonly status: string;
  readonly title: string;
  readonly description: string;
  readonly nextActions: readonly string[];
  readonly warnings?: readonly string[];
}

/**
 * Explains month close status
 */
export function explainMonthCloseStatus(status: MonthCloseStatus): StatusExplanation {
  switch (status) {
    case MonthCloseStatus.DRAFT:
      return {
        status: "DRAFT",
        title: "Draft",
        description: "This month close is being prepared. You can upload files, run matching, and review data.",
        nextActions: [
          "Upload bank statements (CSV files)",
          "Upload invoices (PDF files)",
          "Run matching to find invoice-transaction links",
          "Submit for review when ready",
        ],
      };

    case MonthCloseStatus.IN_REVIEW:
      return {
        status: "IN_REVIEW",
        title: "In Review",
        description: "This month close is under review. Confirm matches and resolve any exceptions before finalizing.",
        nextActions: [
          "Review and confirm proposed matches",
          "Resolve any exceptions or discrepancies",
          "Return to draft if changes are needed",
          "Finalize when all items are resolved",
        ],
        warnings: [
          "Finalizing is irreversible",
        ],
      };

    case MonthCloseStatus.FINALIZED:
      return {
        status: "FINALIZED",
        title: "Finalized",
        description: "This month close has been finalized. No further changes are allowed.",
        nextActions: [
          "View the reconciliation summary",
          "Export reports if needed",
          "Start working on the next month",
        ],
        warnings: [
          "This month cannot be modified",
        ],
      };
  }
}

/**
 * Explains match status
 */
export function explainMatchStatus(status: MatchStatus): StatusExplanation {
  switch (status) {
    case MatchStatus.PROPOSED:
      return {
        status: "PROPOSED",
        title: "Proposed",
        description: "This match has been suggested by the system. Review and confirm or reject it.",
        nextActions: [
          "Review the match details",
          "Confirm if the match is correct",
          "Reject if the match is incorrect",
        ],
      };

    case MatchStatus.CONFIRMED:
      return {
        status: "CONFIRMED",
        title: "Confirmed",
        description: "This match has been confirmed. The transaction and invoice are linked.",
        nextActions: [
          "No further action needed",
        ],
      };

    case MatchStatus.REJECTED:
      return {
        status: "REJECTED",
        title: "Rejected",
        description: "This match was rejected. The transaction and invoice are not linked.",
        nextActions: [
          "Items may be matched again in a future matching run",
        ],
      };
  }
}

/**
 * Explains file asset status
 */
export function explainFileAssetStatus(status: FileAssetStatus): StatusExplanation {
  switch (status) {
    case FileAssetStatus.PENDING_UPLOAD:
      return {
        status: "PENDING_UPLOAD",
        title: "Pending Upload",
        description: "The file is waiting to be uploaded.",
        nextActions: [
          "Wait for upload to complete",
          "Retry if upload fails",
        ],
      };

    case FileAssetStatus.UPLOADED:
      return {
        status: "UPLOADED",
        title: "Uploaded",
        description: "The file has been uploaded and is ready for processing.",
        nextActions: [
          "Parse the file to extract data",
        ],
      };

    case FileAssetStatus.VERIFIED:
      return {
        status: "VERIFIED",
        title: "Verified",
        description: "The file has been verified and its data has been processed.",
        nextActions: [
          "View extracted data",
          "Run matching",
        ],
      };

    case FileAssetStatus.REJECTED:
      return {
        status: "REJECTED",
        title: "Rejected",
        description: "The file was rejected due to validation issues.",
        nextActions: [
          "Check the error details",
          "Upload a corrected file",
        ],
      };

    case FileAssetStatus.DELETED:
      return {
        status: "DELETED",
        title: "Deleted",
        description: "The file has been deleted.",
        nextActions: [
          "Upload a new file if needed",
        ],
      };
  }
}

/**
 * Explains parse status
 */
export function explainParseStatus(status: ParseStatus): StatusExplanation {
  switch (status) {
    case ParseStatus.PENDING:
      return {
        status: "PENDING",
        title: "Pending",
        description: "The file is waiting to be parsed.",
        nextActions: [
          "Start parsing to extract data",
        ],
      };

    case ParseStatus.PARSED:
      return {
        status: "PARSED",
        title: "Parsed",
        description: "The file has been successfully parsed and data has been extracted.",
        nextActions: [
          "Review extracted data",
          "Run matching",
        ],
      };

    case ParseStatus.FAILED:
      return {
        status: "FAILED",
        title: "Failed",
        description: "Parsing failed. The file may have an invalid format or missing data.",
        nextActions: [
          "Check the file format",
          "Retry parsing",
          "Upload a corrected file",
        ],
      };
  }
}

// ============================================================================
// WORKFLOW EXPLANATIONS
// ============================================================================

export interface WorkflowExplanation {
  readonly name: string;
  readonly purpose: string;
  readonly steps: readonly string[];
  readonly outcome: string;
}

export const WORKFLOW_EXPLANATIONS: Record<string, WorkflowExplanation> = {
  FILE_INGESTION: {
    name: "File Upload",
    purpose: "Upload a file to the system for processing",
    steps: [
      "File is validated",
      "File is uploaded to secure storage",
      "File metadata is recorded",
      "File is ready for parsing",
    ],
    outcome: "File is available in the system",
  },

  FILE_PARSE: {
    name: "File Parsing",
    purpose: "Extract structured data from a file",
    steps: [
      "File content is read",
      "Data is extracted (transactions or invoice data)",
      "Extracted data is validated",
      "Data is saved to the database",
    ],
    outcome: "Extracted data is available for matching",
  },

  MATCHING: {
    name: "Matching",
    purpose: "Find links between bank transactions and invoices",
    steps: [
      "Transactions are loaded",
      "Invoices are loaded",
      "Matching algorithm runs",
      "Match proposals are saved",
    ],
    outcome: "Proposed matches are available for review",
  },

  MATCH_CONFIRM: {
    name: "Match Confirmation",
    purpose: "Confirm that a proposed match is correct",
    steps: [
      "Match is validated",
      "Match status is updated to CONFIRMED",
    ],
    outcome: "Transaction and invoice are linked",
  },

  MATCH_REJECT: {
    name: "Match Rejection",
    purpose: "Reject an incorrect proposed match",
    steps: [
      "Match is validated",
      "Match status is updated to REJECTED",
    ],
    outcome: "Items may be matched differently in the future",
  },

  MONTH_CLOSE_SUBMIT: {
    name: "Submit for Review",
    purpose: "Move month close from Draft to In Review",
    steps: [
      "Current state is validated",
      "Aggregates are computed",
      "Status is updated to IN_REVIEW",
    ],
    outcome: "Month close is ready for final review",
  },

  MONTH_CLOSE_FINALIZE: {
    name: "Finalize Month",
    purpose: "Permanently finalize the month close",
    steps: [
      "All exceptions must be resolved",
      "All high-priority issues must be addressed",
      "Status is updated to FINALIZED",
      "Month close becomes immutable",
    ],
    outcome: "Month close is complete and cannot be changed",
  },
};

// ============================================================================
// ACTION EXPLANATIONS
// ============================================================================

export interface ActionExplanation {
  readonly action: string;
  readonly description: string;
  readonly requirements: readonly string[];
  readonly impact: string;
  readonly reversible: boolean;
}

export const ACTION_EXPLANATIONS: Record<string, ActionExplanation> = {
  CONFIRM_MATCH: {
    action: "Confirm Match",
    description: "Mark this match as correct, linking the transaction to the invoice.",
    requirements: [
      "Match must be in PROPOSED status",
      "Month close must not be FINALIZED",
    ],
    impact: "The transaction and invoice will be linked. This counts toward reconciliation.",
    reversible: false,
  },

  REJECT_MATCH: {
    action: "Reject Match",
    description: "Mark this match as incorrect. Items may be matched differently.",
    requirements: [
      "Match must be in PROPOSED status",
      "Month close must not be FINALIZED",
    ],
    impact: "The items will not be linked. They may appear in future match proposals.",
    reversible: false,
  },

  SUBMIT_FOR_REVIEW: {
    action: "Submit for Review",
    description: "Move the month close to review status for final verification.",
    requirements: [
      "Month close must be in DRAFT status",
      "Recommended: Upload and parse all files first",
    ],
    impact: "The month close enters review mode. You can still return to draft if needed.",
    reversible: true,
  },

  FINALIZE_MONTH: {
    action: "Finalize Month",
    description: "Permanently close the month. This action CANNOT be undone.",
    requirements: [
      "Month close must be in IN_REVIEW status",
      "All exceptions must be resolved",
      "All high-priority issues must be addressed",
    ],
    impact: "The month close becomes permanent and immutable. No further changes are possible.",
    reversible: false,
  },

  RETURN_TO_DRAFT: {
    action: "Return to Draft",
    description: "Move the month close back to draft status for further editing.",
    requirements: [
      "Month close must be in IN_REVIEW status",
    ],
    impact: "You can continue making changes to the month close.",
    reversible: true,
  },
};

// ============================================================================
// PROGRESS EXPLANATIONS
// ============================================================================

/**
 * Generates a human-readable progress message
 */
export function explainProgress(
  workflowName: string,
  currentStep: string,
  percent?: number
): string {
  const workflow = WORKFLOW_EXPLANATIONS[workflowName];
  if (!workflow) {
    return `Processing: ${currentStep}`;
  }

  const percentStr = percent !== undefined ? ` (${percent}%)` : "";
  return `${workflow.name}${percentStr}: ${currentStep}`;
}

// ============================================================================
// CONTEXTUAL GUIDANCE
// ============================================================================

/**
 * Provides contextual guidance based on current state
 */
export function getContextualGuidance(
  monthCloseStatus: MonthCloseStatus,
  hasFiles: boolean,
  hasParsedData: boolean,
  hasProposedMatches: boolean,
  openExceptionsCount: number
): string[] {
  const guidance: string[] = [];

  if (monthCloseStatus === MonthCloseStatus.FINALIZED) {
    return ["This month is finalized. View the summary or start a new month."];
  }

  if (monthCloseStatus === MonthCloseStatus.DRAFT) {
    if (!hasFiles) {
      guidance.push("Start by uploading your bank statement (CSV) and invoices (PDF).");
    } else if (!hasParsedData) {
      guidance.push("Parse your uploaded files to extract transaction and invoice data.");
    } else if (!hasProposedMatches) {
      guidance.push("Run matching to find links between transactions and invoices.");
    } else {
      guidance.push("Review the proposed matches, then submit for review when ready.");
    }
  }

  if (monthCloseStatus === MonthCloseStatus.IN_REVIEW) {
    if (openExceptionsCount > 0) {
      guidance.push(`Resolve ${openExceptionsCount} open exceptions before finalizing.`);
    } else {
      guidance.push("All exceptions resolved. You can finalize when ready.");
    }
    guidance.push("Return to draft if you need to make changes.");
  }

  return guidance;
}
