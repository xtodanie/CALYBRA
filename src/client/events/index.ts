/**
 * Client Events - Main exports
 *
 * Structured progress tracking, error handling, and explanations.
 */

// Progress tracking
export {
  FILE_INGESTION_STEPS,
  MATCHING_STEPS,
  INVOICE_CREATE_STEPS,
  MONTH_CLOSE_STEPS,
  ProgressEmitter,
  type WorkflowExecution,
  type WorkflowStatus,
} from "./progress";

// Error handling
export {
  ERROR_CODES,
  createError,
  createErrorFromException,
  type OrchestrationError,
  type ErrorCode,
  type ErrorCategory,
} from "./errors";

// Explanations
export {
  explainMonthCloseStatus,
  explainMatchStatus,
  explainFileAssetStatus,
  WORKFLOW_EXPLANATIONS,
  ACTION_EXPLANATIONS,
  getContextualGuidance,
  type StatusExplanation,
  type WorkflowExplanation,
  type ActionExplanation,
} from "./explanations";
