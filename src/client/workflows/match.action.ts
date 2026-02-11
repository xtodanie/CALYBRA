/**
 * Match Action - Workflow adapter for matching operations
 *
 * INVARIANT: All matching operations go through this action
 * INVARIANT: Action calls exactly one workflow per intent
 * INVARIANT: Progress is observable at all times
 */

import { httpsCallable, type Functions } from "firebase/functions";
import { guardRequestMatch, guardConfirmMatch, guardRejectMatch, GuardResult } from "../orchestration/guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  MATCHING_STEPS,
  MATCH_CONFIRM_STEPS,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";
import { UserRole, MonthCloseStatus, MatchStatus } from "@/lib/types";

// ============================================================================
// MATCHING TYPES
// ============================================================================

export interface RunMatchingInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
}

export interface RunMatchingResult {
  readonly matched: number;
  readonly ambiguous: number;
  readonly unmatched: number;
  readonly matchIds: readonly string[];
}

export interface ConfirmMatchInput {
  readonly matchId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
}

export interface ConfirmMatchResult {
  readonly matchId: string;
  readonly newStatus: string;
}

export interface MatchingContext {
  readonly role: UserRole;
  readonly monthCloseStatus: MonthCloseStatus;
  readonly matchStatus?: MatchStatus;
}

// ============================================================================
// RUN MATCHING ACTION
// ============================================================================

/**
 * Executes matching workflow
 */
export async function executeRunMatching(
  functions: Functions,
  input: RunMatchingInput,
  context: MatchingContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<RunMatchingResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_match_${input.monthCloseId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardRequestMatch(context.role, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "REQUEST_MATCH");

  try {
    // Step 2: Emit progress events
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Initiating matching process",
      MATCHING_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const loadingTxEvent = createProgressEvent(
      workflowId,
      "Loading bank transactions",
      MATCHING_STEPS.LOADING_TRANSACTIONS,
      { percent: 20 }
    );
    emitter.emit(loadingTxEvent);
    execution = updateWorkflowProgress(execution, loadingTxEvent);

    const loadingInvEvent = createProgressEvent(
      workflowId,
      "Loading invoices",
      MATCHING_STEPS.LOADING_INVOICES,
      { percent: 40 }
    );
    emitter.emit(loadingInvEvent);
    execution = updateWorkflowProgress(execution, loadingInvEvent);

    const computingEvent = createProgressEvent(
      workflowId,
      "Computing matches",
      MATCHING_STEPS.COMPUTING_MATCHES,
      { percent: 60 }
    );
    emitter.emit(computingEvent);
    execution = updateWorkflowProgress(execution, computingEvent);

    // Step 3: Call server workflow
    const result = await callRunMatching(functions, {
      tenantId: input.tenantId,
      monthCloseId: input.monthCloseId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Matching failed");
    }

    // Step 4: Complete
    const savingEvent = createProgressEvent(
      workflowId,
      "Saving match proposals",
      MATCHING_STEPS.SAVING_PROPOSALS,
      { percent: 80 }
    );
    emitter.emit(savingEvent);
    execution = updateWorkflowProgress(execution, savingEvent);

    const completedEvent = createProgressEvent(
      workflowId,
      `Matching completed: ${result.matched} matches found`,
      MATCHING_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const matchResult: RunMatchingResult = {
      matched: result.matched!,
      ambiguous: result.ambiguous!,
      unmatched: result.unmatched!,
      matchIds: result.matchIds!,
    };

    execution = completeWorkflow(execution, matchResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<RunMatchingResult>,
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
      "Matching failed",
      MATCHING_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<RunMatchingResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CONFIRM MATCH ACTION
// ============================================================================

/**
 * Executes match confirmation workflow
 */
export async function executeConfirmMatch(
  functions: Functions,
  input: ConfirmMatchInput,
  context: MatchingContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<ConfirmMatchResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_confirm_${input.matchId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  if (!context.matchStatus) {
    return {
      success: false,
      error: createError(ERROR_CODES.INVALID_INPUT, {
        message: "Match status required",
        userMessage: "Unable to determine match status",
      }),
    };
  }

  const guardResult = guardConfirmMatch(context.role, context.matchStatus, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "CONFIRM_MATCH");

  try {
    // Emit progress
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Confirming match",
      MATCH_CONFIRM_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const validatingEvent = createProgressEvent(
      workflowId,
      "Validating match",
      MATCH_CONFIRM_STEPS.VALIDATING,
      { percent: 30 }
    );
    emitter.emit(validatingEvent);
    execution = updateWorkflowProgress(execution, validatingEvent);

    // Call server
    const result = await callConfirmMatch(functions, {
      matchId: input.matchId,
      tenantId: input.tenantId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Confirmation failed");
    }

    // Complete
    const updatingEvent = createProgressEvent(
      workflowId,
      "Updating match status",
      MATCH_CONFIRM_STEPS.UPDATING,
      { percent: 70 }
    );
    emitter.emit(updatingEvent);
    execution = updateWorkflowProgress(execution, updatingEvent);

    const completedEvent = createProgressEvent(
      workflowId,
      "Match confirmed",
      MATCH_CONFIRM_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const confirmResult: ConfirmMatchResult = {
      matchId: input.matchId,
      newStatus: "CONFIRMED",
    };

    execution = completeWorkflow(execution, confirmResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<ConfirmMatchResult>,
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
      "Match confirmation failed",
      MATCH_CONFIRM_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<ConfirmMatchResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// REJECT MATCH ACTION
// ============================================================================

/**
 * Executes match rejection workflow
 */
export async function executeRejectMatch(
  functions: Functions,
  input: ConfirmMatchInput,
  context: MatchingContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<ConfirmMatchResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_reject_${input.matchId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  if (!context.matchStatus) {
    return {
      success: false,
      error: createError(ERROR_CODES.INVALID_INPUT, {
        message: "Match status required",
        userMessage: "Unable to determine match status",
      }),
    };
  }

  const guardResult = guardRejectMatch(context.role, context.matchStatus, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "REJECT_MATCH");

  try {
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Rejecting match",
      MATCH_CONFIRM_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    // Call server
    const result = await callRejectMatch(functions, {
      matchId: input.matchId,
      tenantId: input.tenantId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Rejection failed");
    }

    const completedEvent = createProgressEvent(
      workflowId,
      "Match rejected",
      MATCH_CONFIRM_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const rejectResult: ConfirmMatchResult = {
      matchId: input.matchId,
      newStatus: "REJECTED",
    };

    execution = completeWorkflow(execution, rejectResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<ConfirmMatchResult>,
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
      "Match rejection failed",
      MATCH_CONFIRM_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<ConfirmMatchResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CLOUD FUNCTION CALLS
// ============================================================================

interface RunMatchingParams {
  tenantId: string;
  monthCloseId: string;
}

interface RunMatchingResponse {
  success: boolean;
  matched?: number;
  ambiguous?: number;
  unmatched?: number;
  matchIds?: string[];
  message?: string;
}

async function callRunMatching(
  functions: Functions,
  params: RunMatchingParams
): Promise<RunMatchingResponse> {
  const callable = httpsCallable<RunMatchingParams, RunMatchingResponse>(functions, "runMatching");
  const result = await callable(params);
  return result.data;
}

interface ConfirmMatchParams {
  matchId: string;
  tenantId: string;
}

interface ConfirmMatchResponse {
  success: boolean;
  message?: string;
}

async function callConfirmMatch(
  functions: Functions,
  params: ConfirmMatchParams
): Promise<ConfirmMatchResponse> {
  const callable = httpsCallable<ConfirmMatchParams, ConfirmMatchResponse>(functions, "confirmMatch");
  const result = await callable(params);
  return result.data;
}

async function callRejectMatch(
  functions: Functions,
  params: ConfirmMatchParams
): Promise<ConfirmMatchResponse> {
  const callable = httpsCallable<ConfirmMatchParams, ConfirmMatchResponse>(functions, "rejectMatch");
  const result = await callable(params);
  return result.data;
}
