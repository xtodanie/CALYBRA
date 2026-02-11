/**
 * Actions - Intent to Workflow mapping
 *
 * Each action must:
 * - Accept a UserIntent
 * - Call exactly one backend workflow
 * - Return a workflow execution handle
 *
 * No action may:
 * - Call Firestore directly
 * - Compute business results
 * - Mutate UI state optimistically
 *
 * INVARIANT: Actions are pure orchestration
 * INVARIANT: One intent = one workflow call
 */

import { httpsCallable, type Functions } from "firebase/functions";
import { UserIntent, describeIntent } from "./intent";
import { guardIntent, IntentGuardContext, GuardResult } from "./guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";

// ============================================================================
// ACTION RESULT TYPES
// ============================================================================

export interface ActionSuccess<T = unknown> {
  readonly success: true;
  readonly execution: WorkflowExecution<T>;
}

export interface ActionFailure {
  readonly success: false;
  readonly error: OrchestrationError;
  readonly guardResult?: GuardResult;
}

export type ActionResult<T = unknown> = ActionSuccess<T> | ActionFailure;

// ============================================================================
// WORKFLOW HANDLES
// ============================================================================

export interface WorkflowHandle<T = unknown> {
  readonly id: string;
  readonly intentType: string;
  readonly subscribe: (listener: (execution: WorkflowExecution<T>) => void) => () => void;
  readonly getExecution: () => WorkflowExecution<T>;
  readonly cancel?: () => Promise<void>;
}

// ============================================================================
// ACTION EXECUTOR
// ============================================================================

/**
 * Generates a unique workflow ID
 */
function generateWorkflowId(): string {
  return `wf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * ActionExecutor handles intent-to-workflow mapping
 */
export class ActionExecutor {
  private functions: Functions;
  private activeWorkflows: Map<string, {
    emitter: ProgressEmitter;
    execution: WorkflowExecution;
  }> = new Map();

  constructor(functions: Functions) {
    this.functions = functions;
  }

  /**
   * Executes an intent after guard validation
   */
  async execute<T = unknown>(
    intent: UserIntent,
    context: IntentGuardContext
  ): Promise<ActionResult<T>> {
    // Step 1: Guard validation
    const guardResult = guardIntent(intent, context);
    if (!guardResult.allowed) {
      return {
        success: false,
        error: createError(ERROR_CODES.PERMISSION_DENIED, {
          message: guardResult.reason,
          userMessage: guardResult.userMessage,
          context: { code: guardResult.code },
        }),
        guardResult,
      };
    }

    // Step 2: Create workflow execution
    const workflowId = generateWorkflowId();
    const emitter = new ProgressEmitter();
    let execution = createWorkflowExecution(workflowId, intent.type);

    this.activeWorkflows.set(workflowId, { emitter, execution });

    try {
      // Step 3: Emit initial progress
      const startEvent = createProgressEvent(
        workflowId,
        "INITIATED",
        `${intent.type}_INITIATED`,
        { explanation: describeIntent(intent) }
      );
      emitter.emit(startEvent);
      execution = updateWorkflowProgress(execution, startEvent);
      this.activeWorkflows.set(workflowId, { emitter, execution });

      // Step 4: Call the appropriate workflow
      const result = await this.dispatchToWorkflow<T>(intent, workflowId, emitter);

      // Step 5: Complete with result
      const completeEvent = createProgressEvent(
        workflowId,
        "COMPLETED",
        `${intent.type}_COMPLETED`,
        { percent: 100 }
      );
      emitter.emit(completeEvent);
      execution = updateWorkflowProgress(execution, completeEvent);
      execution = completeWorkflow(execution, result);
      this.activeWorkflows.set(workflowId, { emitter, execution });

      return {
        success: true,
        execution: execution as WorkflowExecution<T>,
      };
    } catch (error) {
      // Step 6: Handle failure
      const orchestrationError = createErrorFromException(error);
      const workflowError: WorkflowError = {
        code: orchestrationError.code,
        message: orchestrationError.message,
        recoverable: orchestrationError.recoverable,
        retryable: orchestrationError.retryable,
      };

      const failEvent = createProgressEvent(
        workflowId,
        "FAILED",
        `${intent.type}_FAILED`,
        { explanation: orchestrationError.userMessage }
      );
      emitter.emit(failEvent);
      execution = updateWorkflowProgress(execution, failEvent);
      execution = failWorkflow(execution, workflowError);
      this.activeWorkflows.set(workflowId, { emitter, execution });

      return {
        success: false,
        error: orchestrationError,
      };
    }
  }

  /**
   * Gets a handle to an active workflow
   */
  getWorkflowHandle<T = unknown>(workflowId: string): WorkflowHandle<T> | null {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return null;

    return {
      id: workflowId,
      intentType: workflow.execution.intentType,
      subscribe: (listener) => {
        return workflow.emitter.subscribe(() => {
          const current = this.activeWorkflows.get(workflowId);
          if (current) {
            listener(current.execution as WorkflowExecution<T>);
          }
        });
      },
      getExecution: () => workflow.execution as WorkflowExecution<T>,
    };
  }

  /**
   * Gets all active workflow handles
   */
  getActiveWorkflows(): readonly WorkflowHandle[] {
    return Array.from(this.activeWorkflows.entries())
      .filter(([, workflow]) => 
        workflow.execution.status === "PENDING" || 
        workflow.execution.status === "RUNNING"
      )
      .map(([id, workflow]) => ({
        id,
        intentType: workflow.execution.intentType,
        subscribe: (listener: (execution: WorkflowExecution) => void) => {
          return workflow.emitter.subscribe(() => {
            const current = this.activeWorkflows.get(id);
            if (current) {
              listener(current.execution);
            }
          });
        },
        getExecution: () => workflow.execution,
      }));
  }

  /**
   * Dispatches intent to the appropriate Cloud Function
   */
  private async dispatchToWorkflow<T>(
    intent: UserIntent,
    workflowId: string,
    emitter: ProgressEmitter
  ): Promise<T> {
    switch (intent.type) {
      case "UPLOAD_FILE":
        return this.callFunction<T>("ingestFile", {
          fileId: intent.fileId,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
          filename: intent.filename,
          kind: intent.kind,
        }, workflowId, emitter);

      case "REQUEST_PARSE":
      case "RETRY_PARSE":
        return this.callFunction<T>("parseFile", {
          fileId: intent.fileId,
          tenantId: intent.tenantId,
        }, workflowId, emitter);

      case "REQUEST_MATCH":
        return this.callFunction<T>("runMatching", {
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
        }, workflowId, emitter);

      case "CONFIRM_MATCH":
        return this.callFunction<T>("confirmMatch", {
          matchId: intent.matchId,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
        }, workflowId, emitter);

      case "REJECT_MATCH":
        return this.callFunction<T>("rejectMatch", {
          matchId: intent.matchId,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
        }, workflowId, emitter);

      case "CONFIRM_ALL_MATCHES":
        return this.callFunction<T>("confirmAllMatches", {
          matchIds: intent.matchIds,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
        }, workflowId, emitter);

      case "CREATE_INVOICE":
        return this.callFunction<T>("createInvoice", {
          invoiceId: intent.invoiceId,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
          sourceFileId: intent.sourceFileId,
        }, workflowId, emitter);

      case "CREATE_INVOICE_MANUAL":
        return this.callFunction<T>("createInvoiceManual", {
          invoiceId: intent.invoiceId,
          tenantId: intent.tenantId,
          monthCloseId: intent.monthCloseId,
          supplierName: intent.supplierName,
          invoiceNumber: intent.invoiceNumber,
          issueDate: intent.issueDate,
          totalGross: intent.totalGross,
          vatRate: intent.vatRate,
        }, workflowId, emitter);

      case "CREATE_MONTH_CLOSE":
        return this.callFunction<T>("createMonthClose", {
          monthCloseId: intent.monthCloseId,
          tenantId: intent.tenantId,
          periodStart: intent.periodStart.toISOString(),
          periodEnd: intent.periodEnd.toISOString(),
          currency: intent.currency,
        }, workflowId, emitter);

      case "SUBMIT_FOR_REVIEW":
        return this.callFunction<T>("transitionMonthClose", {
          monthCloseId: intent.monthCloseId,
          tenantId: intent.tenantId,
          toStatus: "IN_REVIEW",
        }, workflowId, emitter);

      case "RETURN_TO_DRAFT":
        return this.callFunction<T>("transitionMonthClose", {
          monthCloseId: intent.monthCloseId,
          tenantId: intent.tenantId,
          toStatus: "DRAFT",
        }, workflowId, emitter);

      case "FINALIZE_MONTH":
        return this.callFunction<T>("finalizeMonthClose", {
          monthCloseId: intent.monthCloseId,
          tenantId: intent.tenantId,
        }, workflowId, emitter);

      case "COMPUTE_AGGREGATES":
        return this.callFunction<T>("computeMonthCloseAggregates", {
          monthCloseId: intent.monthCloseId,
          tenantId: intent.tenantId,
        }, workflowId, emitter);

      case "RETRY_UPLOAD":
      case "CANCEL_UPLOAD":
        // These are client-side operations, handled differently
        return Promise.resolve({} as T);

      default:
        throw new Error(`Unknown intent type: ${(intent as UserIntent).type}`);
    }
  }

  /**
   * Calls a Cloud Function and updates progress
   */
  private async callFunction<T>(
    functionName: string,
    params: Record<string, unknown>,
    workflowId: string,
    emitter: ProgressEmitter
  ): Promise<T> {
    // Emit calling progress
    const callingEvent = createProgressEvent(
      workflowId,
      "CALLING_SERVER",
      "WORKFLOW_CALLING_SERVER",
      { 
        explanation: `Calling ${functionName}`,
        metadata: { functionName },
      }
    );
    emitter.emit(callingEvent);

    // Call the function
    const callable = httpsCallable<typeof params, T>(this.functions, functionName);
    const result = await callable(params);

    // Emit server response progress
    const responseEvent = createProgressEvent(
      workflowId,
      "SERVER_RESPONDED",
      "WORKFLOW_SERVER_RESPONDED",
      { explanation: "Server responded" }
    );
    emitter.emit(responseEvent);

    return result.data;
  }
}

// ============================================================================
// ACTION CONTEXT PROVIDER (for React)
// ============================================================================

export interface ActionContextValue {
  readonly executor: ActionExecutor;
  readonly executeIntent: <T = unknown>(
    intent: UserIntent,
    context: IntentGuardContext
  ) => Promise<ActionResult<T>>;
  readonly getWorkflow: <T = unknown>(id: string) => WorkflowHandle<T> | null;
  readonly activeWorkflows: readonly WorkflowHandle[];
}

/**
 * Creates an action context value
 */
export function createActionContext(functions: Functions): ActionContextValue {
  const executor = new ActionExecutor(functions);

  return {
    executor,
    executeIntent: <T = unknown>(intent: UserIntent, context: IntentGuardContext) =>
      executor.execute<T>(intent, context),
    getWorkflow: <T = unknown>(id: string) => executor.getWorkflowHandle<T>(id),
    get activeWorkflows() {
      return executor.getActiveWorkflows();
    },
  };
}
