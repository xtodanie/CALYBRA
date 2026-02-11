/**
 * Progress Events - Structured workflow progress tracking
 *
 * Every workflow step must emit:
 * - Step name
 * - Timestamp
 * - Human-readable explanation
 * - Machine-readable code
 *
 * INVARIANT: No silent steps allowed
 * INVARIANT: All progress is observable
 * INVARIANT: Progress events are immutable after emission
 */

// ============================================================================
// WORKFLOW STATUS
// ============================================================================

export type WorkflowStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";

// ============================================================================
// PROGRESS EVENT TYPES
// ============================================================================

export interface ProgressEvent {
  readonly id: string;
  readonly workflowId: string;
  readonly step: string;
  readonly code: string;
  readonly explanation: string;
  readonly timestamp: number;
  readonly percent?: number;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// STEP CODES BY WORKFLOW
// ============================================================================

export const FILE_INGESTION_STEPS = {
  INITIATED: "FILE_INGESTION_INITIATED",
  UPLOADING: "FILE_UPLOADING",
  UPLOAD_COMPLETE: "FILE_UPLOAD_COMPLETE",
  METADATA_SAVED: "FILE_METADATA_SAVED",
  COMPLETED: "FILE_INGESTION_COMPLETED",
  FAILED: "FILE_INGESTION_FAILED",
} as const;

export const FILE_PARSE_STEPS = {
  INITIATED: "FILE_PARSE_INITIATED",
  READING_CONTENT: "FILE_READING_CONTENT",
  EXTRACTING_DATA: "FILE_EXTRACTING_DATA",
  VALIDATING: "FILE_VALIDATING_EXTRACTED",
  SAVING_RESULTS: "FILE_SAVING_RESULTS",
  COMPLETED: "FILE_PARSE_COMPLETED",
  FAILED: "FILE_PARSE_FAILED",
} as const;

export const MATCHING_STEPS = {
  INITIATED: "MATCHING_INITIATED",
  LOADING_TRANSACTIONS: "MATCHING_LOADING_TRANSACTIONS",
  LOADING_INVOICES: "MATCHING_LOADING_INVOICES",
  COMPUTING_MATCHES: "MATCHING_COMPUTING",
  SAVING_PROPOSALS: "MATCHING_SAVING_PROPOSALS",
  COMPLETED: "MATCHING_COMPLETED",
  FAILED: "MATCHING_FAILED",
} as const;

export const MATCH_CONFIRM_STEPS = {
  INITIATED: "MATCH_CONFIRM_INITIATED",
  VALIDATING: "MATCH_VALIDATING",
  UPDATING: "MATCH_UPDATING",
  COMPLETED: "MATCH_CONFIRM_COMPLETED",
  FAILED: "MATCH_CONFIRM_FAILED",
} as const;

export const INVOICE_CREATE_STEPS = {
  INITIATED: "INVOICE_CREATE_INITIATED",
  VALIDATING_DATA: "INVOICE_VALIDATING_DATA",
  CREATING: "INVOICE_CREATING",
  COMPLETED: "INVOICE_CREATE_COMPLETED",
  FAILED: "INVOICE_CREATE_FAILED",
} as const;

export const MONTH_CLOSE_STEPS = {
  INITIATED: "MONTH_CLOSE_INITIATED",
  VALIDATING: "MONTH_CLOSE_VALIDATING",
  LOADING_DATA: "MONTH_CLOSE_LOADING_DATA",
  COMPUTING_AGGREGATES: "MONTH_CLOSE_COMPUTING_AGGREGATES",
  TRANSITIONING: "MONTH_CLOSE_TRANSITIONING",
  FINALIZING: "MONTH_CLOSE_FINALIZING",
  COMPLETED: "MONTH_CLOSE_COMPLETED",
  FAILED: "MONTH_CLOSE_FAILED",
} as const;

// ============================================================================
// HUMAN-READABLE EXPLANATIONS
// ============================================================================

const STEP_EXPLANATIONS: Record<string, string> = {
  // File Ingestion
  [FILE_INGESTION_STEPS.INITIATED]: "Starting file upload process",
  [FILE_INGESTION_STEPS.UPLOADING]: "Uploading file to secure storage",
  [FILE_INGESTION_STEPS.UPLOAD_COMPLETE]: "File upload completed",
  [FILE_INGESTION_STEPS.METADATA_SAVED]: "File metadata saved to database",
  [FILE_INGESTION_STEPS.COMPLETED]: "File ingestion completed successfully",
  [FILE_INGESTION_STEPS.FAILED]: "File ingestion failed",

  // File Parse
  [FILE_PARSE_STEPS.INITIATED]: "Starting file parsing process",
  [FILE_PARSE_STEPS.READING_CONTENT]: "Reading file content",
  [FILE_PARSE_STEPS.EXTRACTING_DATA]: "Extracting structured data from file",
  [FILE_PARSE_STEPS.VALIDATING]: "Validating extracted data",
  [FILE_PARSE_STEPS.SAVING_RESULTS]: "Saving parsed results to database",
  [FILE_PARSE_STEPS.COMPLETED]: "File parsing completed successfully",
  [FILE_PARSE_STEPS.FAILED]: "File parsing failed",

  // Matching
  [MATCHING_STEPS.INITIATED]: "Starting matching process",
  [MATCHING_STEPS.LOADING_TRANSACTIONS]: "Loading bank transactions",
  [MATCHING_STEPS.LOADING_INVOICES]: "Loading invoices",
  [MATCHING_STEPS.COMPUTING_MATCHES]: "Computing match suggestions",
  [MATCHING_STEPS.SAVING_PROPOSALS]: "Saving match proposals",
  [MATCHING_STEPS.COMPLETED]: "Matching completed successfully",
  [MATCHING_STEPS.FAILED]: "Matching process failed",

  // Match Confirm
  [MATCH_CONFIRM_STEPS.INITIATED]: "Starting match confirmation",
  [MATCH_CONFIRM_STEPS.VALIDATING]: "Validating match can be confirmed",
  [MATCH_CONFIRM_STEPS.UPDATING]: "Updating match status",
  [MATCH_CONFIRM_STEPS.COMPLETED]: "Match confirmed successfully",
  [MATCH_CONFIRM_STEPS.FAILED]: "Match confirmation failed",

  // Invoice Create
  [INVOICE_CREATE_STEPS.INITIATED]: "Starting invoice creation",
  [INVOICE_CREATE_STEPS.VALIDATING_DATA]: "Validating invoice data",
  [INVOICE_CREATE_STEPS.CREATING]: "Creating invoice record",
  [INVOICE_CREATE_STEPS.COMPLETED]: "Invoice created successfully",
  [INVOICE_CREATE_STEPS.FAILED]: "Invoice creation failed",

  // Month Close
  [MONTH_CLOSE_STEPS.INITIATED]: "Starting month close process",
  [MONTH_CLOSE_STEPS.VALIDATING]: "Validating month close requirements",
  [MONTH_CLOSE_STEPS.LOADING_DATA]: "Loading month close data",
  [MONTH_CLOSE_STEPS.COMPUTING_AGGREGATES]: "Computing reconciliation aggregates",
  [MONTH_CLOSE_STEPS.TRANSITIONING]: "Transitioning month close status",
  [MONTH_CLOSE_STEPS.FINALIZING]: "Finalizing month close (IRREVERSIBLE)",
  [MONTH_CLOSE_STEPS.COMPLETED]: "Month close operation completed",
  [MONTH_CLOSE_STEPS.FAILED]: "Month close operation failed",
};

// ============================================================================
// PROGRESS EVENT FACTORY
// ============================================================================

let progressEventCounter = 0;

/**
 * Creates a progress event with all required fields
 */
export function createProgressEvent(
  workflowId: string,
  step: string,
  code: string,
  options?: {
    percent?: number;
    explanation?: string;
    metadata?: Record<string, unknown>;
  }
): ProgressEvent {
  const id = `progress_${Date.now()}_${++progressEventCounter}`;
  return {
    id,
    workflowId,
    step,
    code,
    explanation: options?.explanation ?? STEP_EXPLANATIONS[code] ?? step,
    timestamp: Date.now(),
    percent: options?.percent,
    metadata: options?.metadata,
  };
}

// ============================================================================
// PROGRESS LISTENERS
// ============================================================================

export type ProgressListener = (event: ProgressEvent) => void;

/**
 * Progress emitter for workflow execution
 */
export class ProgressEmitter {
  private listeners: Set<ProgressListener> = new Set();
  private history: ProgressEvent[] = [];

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    // Replay history to new subscriber
    this.history.forEach((event) => listener(event));
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: ProgressEvent): void {
    this.history.push(event);
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Progress listener error:", err);
      }
    });
  }

  getHistory(): readonly ProgressEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}

// ============================================================================
// WORKFLOW EXECUTION CONTEXT
// ============================================================================

/**
 * Workflow execution result
 */
export interface WorkflowExecution<T = unknown> {
  readonly id: string;
  readonly intentType: string;
  readonly status: WorkflowStatus;
  readonly progress: readonly ProgressEvent[];
  readonly result?: T;
  readonly error?: WorkflowError;
  readonly startedAt: number;
  readonly completedAt?: number;
}

/**
 * Workflow error
 */
export interface WorkflowError {
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly retryable: boolean;
}

/**
 * Creates initial workflow execution
 */
export function createWorkflowExecution(
  id: string,
  intentType: string
): WorkflowExecution {
  return {
    id,
    intentType,
    status: "PENDING",
    progress: [],
    startedAt: Date.now(),
  };
}

/**
 * Updates workflow execution with new progress
 */
export function updateWorkflowProgress<T>(
  execution: WorkflowExecution<T>,
  event: ProgressEvent
): WorkflowExecution<T> {
  return {
    ...execution,
    status: "RUNNING",
    progress: [...execution.progress, event],
  };
}

/**
 * Completes workflow execution successfully
 */
export function completeWorkflow<T>(
  execution: WorkflowExecution<T>,
  result: T
): WorkflowExecution<T> {
  return {
    ...execution,
    status: "SUCCEEDED",
    result,
    completedAt: Date.now(),
  };
}

/**
 * Fails workflow execution
 */
export function failWorkflow<T>(
  execution: WorkflowExecution<T>,
  error: WorkflowError
): WorkflowExecution<T> {
  return {
    ...execution,
    status: "FAILED",
    error,
    completedAt: Date.now(),
  };
}

/**
 * Cancels workflow execution
 */
export function cancelWorkflow<T>(
  execution: WorkflowExecution<T>
): WorkflowExecution<T> {
  return {
    ...execution,
    status: "CANCELLED",
    completedAt: Date.now(),
  };
}
