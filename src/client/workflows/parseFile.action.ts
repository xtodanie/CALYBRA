/**
 * Parse File Action - Workflow adapter for file parsing
 *
 * INVARIANT: All file parsing goes through this action
 * INVARIANT: Action calls exactly one workflow
 * INVARIANT: Progress is observable at all times
 */

import { httpsCallable, type Functions } from "firebase/functions";
import { guardRequestParse, GuardResult } from "../orchestration/guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  FILE_PARSE_STEPS,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";
import { UserRole, FileAssetStatus } from "@/lib/types";

// ============================================================================
// PARSE FILE TYPES
// ============================================================================

export interface ParseFileInput {
  readonly fileId: string;
  readonly tenantId: string;
}

export interface ParseFileResult {
  readonly fileId: string;
  readonly parseStatus: string;
  readonly linesExtracted: number;
  readonly duplicatesSkipped: number;
}

export interface ParseFileContext {
  readonly role: UserRole;
  readonly fileStatus: FileAssetStatus;
  readonly parseStatus?: string;
}

// ============================================================================
// PARSE FILE ACTION
// ============================================================================

/**
 * Executes file parsing workflow
 *
 * Flow:
 * 1. Guard validation
 * 2. Call parse workflow on server
 * 3. Track progress
 * 4. Return result
 */
export async function executeParseFile(
  functions: Functions,
  input: ParseFileInput,
  context: ParseFileContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<ParseFileResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_parse_${input.fileId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardRequestParse(context.role, context.fileStatus, context.parseStatus);
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
  let execution = createWorkflowExecution(workflowId, "REQUEST_PARSE");

  try {
    // Step 2: Emit initiated event
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Initiating file parsing",
      FILE_PARSE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    // Step 3: Call server workflow
    const readingEvent = createProgressEvent(
      workflowId,
      "Reading file content",
      FILE_PARSE_STEPS.READING_CONTENT,
      { percent: 20 }
    );
    emitter.emit(readingEvent);
    execution = updateWorkflowProgress(execution, readingEvent);

    const extractingEvent = createProgressEvent(
      workflowId,
      "Extracting data",
      FILE_PARSE_STEPS.EXTRACTING_DATA,
      { percent: 40 }
    );
    emitter.emit(extractingEvent);
    execution = updateWorkflowProgress(execution, extractingEvent);

    const result = await callParseFile(functions, {
      fileId: input.fileId,
      tenantId: input.tenantId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Parse failed");
    }

    // Step 4: Emit completion events
    const savingEvent = createProgressEvent(
      workflowId,
      "Saving parsed results",
      FILE_PARSE_STEPS.SAVING_RESULTS,
      { percent: 80 }
    );
    emitter.emit(savingEvent);
    execution = updateWorkflowProgress(execution, savingEvent);

    const completedEvent = createProgressEvent(
      workflowId,
      "Parsing completed",
      FILE_PARSE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const parseResult: ParseFileResult = {
      fileId: result.fileId!,
      parseStatus: result.parseStatus!,
      linesExtracted: result.linesExtracted!,
      duplicatesSkipped: result.duplicatesSkipped!,
    };

    execution = completeWorkflow(execution, parseResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<ParseFileResult>,
    };
  } catch (error) {
    const orchestrationError = createErrorFromException(error, ERROR_CODES.PARSE_FAILED);
    const workflowError: WorkflowError = {
      code: orchestrationError.code,
      message: orchestrationError.message,
      recoverable: orchestrationError.recoverable,
      retryable: orchestrationError.retryable,
    };

    const failEvent = createProgressEvent(
      workflowId,
      "Parsing failed",
      FILE_PARSE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<ParseFileResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CLOUD FUNCTION CALLS
// ============================================================================

interface ParseFileParams {
  fileId: string;
  tenantId: string;
}

interface ParseFileResponse {
  success: boolean;
  fileId?: string;
  parseStatus?: string;
  linesExtracted?: number;
  duplicatesSkipped?: number;
  message?: string;
}

async function callParseFile(
  functions: Functions,
  params: ParseFileParams
): Promise<ParseFileResponse> {
  const callable = httpsCallable<ParseFileParams, ParseFileResponse>(functions, "parseFile");
  const result = await callable(params);
  return result.data;
}

// ============================================================================
// RETRY ACTION
// ============================================================================

/**
 * Retries a failed file parse
 */
export async function retryParseFile(
  functions: Functions,
  input: ParseFileInput,
  context: ParseFileContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<ParseFileResult>;
  error?: OrchestrationError;
}> {
  // Update context to allow retry from FAILED state
  const retryContext = {
    ...context,
    parseStatus: "FAILED",
  };
  return executeParseFile(functions, input, retryContext);
}
