/**
 * Month Close Action - Workflow adapter for month close operations
 *
 * INVARIANT: All month close operations go through this action
 * INVARIANT: Action calls exactly one workflow per intent
 * INVARIANT: Progress is observable at all times
 * INVARIANT: Finalization is irreversible and requires explicit confirmation
 */

import { httpsCallable, type Functions } from "firebase/functions";
import {
  guardCreateMonthClose,
  guardSubmitForReview,
  guardReturnToDraft,
  guardFinalizeMonth,
  GuardResult,
} from "../orchestration/guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  MONTH_CLOSE_STEPS,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";
import { UserRole, MonthCloseStatus } from "@/lib/types";

// ============================================================================
// MONTH CLOSE TYPES
// ============================================================================

export interface CreateMonthCloseInput {
  readonly monthCloseId: string;
  readonly tenantId: string;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly currency: "EUR";
}

export interface CreateMonthCloseResult {
  readonly monthCloseId: string;
  readonly status: string;
}

export interface TransitionMonthCloseInput {
  readonly monthCloseId: string;
  readonly tenantId: string;
}

export interface TransitionMonthCloseResult {
  readonly monthCloseId: string;
  readonly fromStatus: string;
  readonly toStatus: string;
}

export interface ComputeAggregatesResult {
  readonly monthCloseId: string;
  readonly bankTotal: number;
  readonly invoiceTotal: number;
  readonly matchedCount: number;
  readonly unmatchedBankCount: number;
  readonly unmatchedInvoiceCount: number;
}

export interface MonthCloseContext {
  readonly role: UserRole;
  readonly monthCloseStatus?: MonthCloseStatus;
  readonly openExceptionsCount?: number;
  readonly highExceptionsCount?: number;
}

// ============================================================================
// CREATE MONTH CLOSE ACTION
// ============================================================================

/**
 * Executes month close creation workflow
 */
export async function executeCreateMonthClose(
  functions: Functions,
  input: CreateMonthCloseInput,
  context: MonthCloseContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<CreateMonthCloseResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_mc_create_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardCreateMonthClose(context.role);
  if (!guardResult.allowed) {
    return {
      success: false,
      error: createError(ERROR_CODES.PERMISSION_DENIED, {
        message: guardResult.reason,
        userMessage: guardResult.userMessage,
      }),
      guardResult,
    };
  }

  // Initialize execution
  let execution = createWorkflowExecution(workflowId, "CREATE_MONTH_CLOSE");

  try {
    // Emit progress
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Creating month close",
      MONTH_CLOSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const validatingEvent = createProgressEvent(
      workflowId,
      "Validating period",
      MONTH_CLOSE_STEPS.VALIDATING,
      { percent: 30 }
    );
    emitter.emit(validatingEvent);
    execution = updateWorkflowProgress(execution, validatingEvent);

    // Call server
    const result = await callCreateMonthClose(functions, {
      monthCloseId: input.monthCloseId,
      tenantId: input.tenantId,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
      currency: input.currency,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Month close creation failed");
    }

    // Complete
    const completedEvent = createProgressEvent(
      workflowId,
      "Month close created",
      MONTH_CLOSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const createResult: CreateMonthCloseResult = {
      monthCloseId: result.monthCloseId!,
      status: result.status!,
    };

    execution = completeWorkflow(execution, createResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<CreateMonthCloseResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Month close creation failed",
      MONTH_CLOSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<CreateMonthCloseResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// SUBMIT FOR REVIEW ACTION
// ============================================================================

/**
 * Executes submit for review workflow
 */
export async function executeSubmitForReview(
  functions: Functions,
  input: TransitionMonthCloseInput,
  context: MonthCloseContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<TransitionMonthCloseResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_mc_review_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  if (!context.monthCloseStatus) {
    return {
      success: false,
      error: createError(ERROR_CODES.INVALID_INPUT, {
        message: "Month close status required",
        userMessage: "Unable to determine month close status",
      }),
    };
  }

  const guardResult = guardSubmitForReview(context.role, context.monthCloseStatus);
  if (!guardResult.allowed) {
    return {
      success: false,
      error: createError(ERROR_CODES.PERMISSION_DENIED, {
        message: guardResult.reason,
        userMessage: guardResult.userMessage,
      }),
      guardResult,
    };
  }

  // Initialize execution
  let execution = createWorkflowExecution(workflowId, "SUBMIT_FOR_REVIEW");

  try {
    // Emit progress
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Submitting for review",
      MONTH_CLOSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const transitioningEvent = createProgressEvent(
      workflowId,
      "Transitioning to IN_REVIEW",
      MONTH_CLOSE_STEPS.TRANSITIONING,
      { percent: 50 }
    );
    emitter.emit(transitioningEvent);
    execution = updateWorkflowProgress(execution, transitioningEvent);

    // Call server
    const result = await callTransitionMonthClose(functions, {
      monthCloseId: input.monthCloseId,
      tenantId: input.tenantId,
      toStatus: "IN_REVIEW",
    });

    if (!result.success) {
      throw new Error(result.message ?? "Transition failed");
    }

    // Complete
    const completedEvent = createProgressEvent(
      workflowId,
      "Submitted for review",
      MONTH_CLOSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const transitionResult: TransitionMonthCloseResult = {
      monthCloseId: input.monthCloseId,
      fromStatus: "DRAFT",
      toStatus: "IN_REVIEW",
    };

    execution = completeWorkflow(execution, transitionResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Submission failed",
      MONTH_CLOSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// RETURN TO DRAFT ACTION
// ============================================================================

/**
 * Executes return to draft workflow
 */
export async function executeReturnToDraft(
  functions: Functions,
  input: TransitionMonthCloseInput,
  context: MonthCloseContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<TransitionMonthCloseResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_mc_draft_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  if (!context.monthCloseStatus) {
    return {
      success: false,
      error: createError(ERROR_CODES.INVALID_INPUT, {
        message: "Month close status required",
        userMessage: "Unable to determine month close status",
      }),
    };
  }

  const guardResult = guardReturnToDraft(context.role, context.monthCloseStatus);
  if (!guardResult.allowed) {
    return {
      success: false,
      error: createError(ERROR_CODES.PERMISSION_DENIED, {
        message: guardResult.reason,
        userMessage: guardResult.userMessage,
      }),
      guardResult,
    };
  }

  // Initialize execution
  let execution = createWorkflowExecution(workflowId, "RETURN_TO_DRAFT");

  try {
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Returning to draft",
      MONTH_CLOSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    // Call server
    const result = await callTransitionMonthClose(functions, {
      monthCloseId: input.monthCloseId,
      tenantId: input.tenantId,
      toStatus: "DRAFT",
    });

    if (!result.success) {
      throw new Error(result.message ?? "Transition failed");
    }

    const completedEvent = createProgressEvent(
      workflowId,
      "Returned to draft",
      MONTH_CLOSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const transitionResult: TransitionMonthCloseResult = {
      monthCloseId: input.monthCloseId,
      fromStatus: "IN_REVIEW",
      toStatus: "DRAFT",
    };

    execution = completeWorkflow(execution, transitionResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Return to draft failed",
      MONTH_CLOSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// FINALIZE MONTH ACTION
// ============================================================================

/**
 * Executes month finalization workflow
 * WARNING: This action is IRREVERSIBLE
 */
export async function executeFinalizeMonth(
  functions: Functions,
  input: TransitionMonthCloseInput,
  context: MonthCloseContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<TransitionMonthCloseResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_mc_finalize_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  if (!context.monthCloseStatus) {
    return {
      success: false,
      error: createError(ERROR_CODES.INVALID_INPUT, {
        message: "Month close status required",
        userMessage: "Unable to determine month close status",
      }),
    };
  }

  const guardResult = guardFinalizeMonth(
    context.role,
    context.monthCloseStatus,
    context.openExceptionsCount ?? 0,
    context.highExceptionsCount ?? 0
  );
  if (!guardResult.allowed) {
    return {
      success: false,
      error: createError(ERROR_CODES.PERMISSION_DENIED, {
        message: guardResult.reason,
        userMessage: guardResult.userMessage,
      }),
      guardResult,
    };
  }

  // Initialize execution
  let execution = createWorkflowExecution(workflowId, "FINALIZE_MONTH");

  try {
    // Emit progress with clear warning
    const initiatedEvent = createProgressEvent(
      workflowId,
      "INITIATING FINALIZATION - THIS IS IRREVERSIBLE",
      MONTH_CLOSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const validatingEvent = createProgressEvent(
      workflowId,
      "Validating finalization requirements",
      MONTH_CLOSE_STEPS.VALIDATING,
      { percent: 20 }
    );
    emitter.emit(validatingEvent);
    execution = updateWorkflowProgress(execution, validatingEvent);

    const loadingEvent = createProgressEvent(
      workflowId,
      "Computing final aggregates",
      MONTH_CLOSE_STEPS.COMPUTING_AGGREGATES,
      { percent: 40 }
    );
    emitter.emit(loadingEvent);
    execution = updateWorkflowProgress(execution, loadingEvent);

    const finalizingEvent = createProgressEvent(
      workflowId,
      "FINALIZING - NO TURNING BACK",
      MONTH_CLOSE_STEPS.FINALIZING,
      { percent: 70 }
    );
    emitter.emit(finalizingEvent);
    execution = updateWorkflowProgress(execution, finalizingEvent);

    // Call server
    const result = await callFinalizeMonthClose(functions, {
      monthCloseId: input.monthCloseId,
      tenantId: input.tenantId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Finalization failed");
    }

    // Complete
    const completedEvent = createProgressEvent(
      workflowId,
      "Month close finalized successfully",
      MONTH_CLOSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const transitionResult: TransitionMonthCloseResult = {
      monthCloseId: input.monthCloseId,
      fromStatus: "IN_REVIEW",
      toStatus: "FINALIZED",
    };

    execution = completeWorkflow(execution, transitionResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Finalization failed",
      MONTH_CLOSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<TransitionMonthCloseResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// COMPUTE AGGREGATES ACTION
// ============================================================================

/**
 * Executes compute aggregates workflow
 */
export async function executeComputeAggregates(
  functions: Functions,
  input: TransitionMonthCloseInput,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _context: MonthCloseContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<ComputeAggregatesResult>;
  error?: OrchestrationError;
}> {
  const workflowId = `wf_mc_agg_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Initialize execution
  let execution = createWorkflowExecution(workflowId, "COMPUTE_AGGREGATES");

  try {
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Computing aggregates",
      MONTH_CLOSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const loadingEvent = createProgressEvent(
      workflowId,
      "Loading month data",
      MONTH_CLOSE_STEPS.LOADING_DATA,
      { percent: 30 }
    );
    emitter.emit(loadingEvent);
    execution = updateWorkflowProgress(execution, loadingEvent);

    const computingEvent = createProgressEvent(
      workflowId,
      "Computing reconciliation",
      MONTH_CLOSE_STEPS.COMPUTING_AGGREGATES,
      { percent: 60 }
    );
    emitter.emit(computingEvent);
    execution = updateWorkflowProgress(execution, computingEvent);

    // Call server
    const result = await callComputeAggregates(functions, {
      monthCloseId: input.monthCloseId,
      tenantId: input.tenantId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Compute failed");
    }

    const completedEvent = createProgressEvent(
      workflowId,
      "Aggregates computed",
      MONTH_CLOSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const aggResult: ComputeAggregatesResult = {
      monthCloseId: input.monthCloseId,
      bankTotal: result.bankTotal!,
      invoiceTotal: result.invoiceTotal!,
      matchedCount: result.matchedCount!,
      unmatchedBankCount: result.unmatchedBankCount!,
      unmatchedInvoiceCount: result.unmatchedInvoiceCount!,
    };

    execution = completeWorkflow(execution, aggResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<ComputeAggregatesResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Compute failed",
      MONTH_CLOSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<ComputeAggregatesResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CLOUD FUNCTION CALLS
// ============================================================================

interface CreateMonthCloseParams {
  monthCloseId: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
}

interface CreateMonthCloseResponse {
  success: boolean;
  monthCloseId?: string;
  status?: string;
  message?: string;
}

async function callCreateMonthClose(
  functions: Functions,
  params: CreateMonthCloseParams
): Promise<CreateMonthCloseResponse> {
  const callable = httpsCallable<CreateMonthCloseParams, CreateMonthCloseResponse>(
    functions,
    "createMonthClose"
  );
  const result = await callable(params);
  return result.data;
}

interface TransitionMonthCloseParams {
  monthCloseId: string;
  tenantId: string;
  toStatus: string;
}

interface TransitionMonthCloseResponse {
  success: boolean;
  message?: string;
}

async function callTransitionMonthClose(
  functions: Functions,
  params: TransitionMonthCloseParams
): Promise<TransitionMonthCloseResponse> {
  const callable = httpsCallable<TransitionMonthCloseParams, TransitionMonthCloseResponse>(
    functions,
    "transitionMonthClose"
  );
  const result = await callable(params);
  return result.data;
}

interface FinalizeMonthCloseParams {
  monthCloseId: string;
  tenantId: string;
}

interface FinalizeMonthCloseResponse {
  success: boolean;
  message?: string;
}

async function callFinalizeMonthClose(
  functions: Functions,
  params: FinalizeMonthCloseParams
): Promise<FinalizeMonthCloseResponse> {
  const callable = httpsCallable<FinalizeMonthCloseParams, FinalizeMonthCloseResponse>(
    functions,
    "finalizeMonthClose"
  );
  const result = await callable(params);
  return result.data;
}

interface ComputeAggregatesParams {
  monthCloseId: string;
  tenantId: string;
}

interface ComputeAggregatesResponse {
  success: boolean;
  bankTotal?: number;
  invoiceTotal?: number;
  matchedCount?: number;
  unmatchedBankCount?: number;
  unmatchedInvoiceCount?: number;
  message?: string;
}

async function callComputeAggregates(
  functions: Functions,
  params: ComputeAggregatesParams
): Promise<ComputeAggregatesResponse> {
  const callable = httpsCallable<ComputeAggregatesParams, ComputeAggregatesResponse>(
    functions,
    "computeMonthCloseAggregates"
  );
  const result = await callable(params);
  return result.data;
}
