/**
 * Invoice Create Action - Workflow adapter for invoice creation
 *
 * INVARIANT: All invoice creation goes through this action
 * INVARIANT: Action calls exactly one workflow
 * INVARIANT: Progress is observable at all times
 */

import { httpsCallable, type Functions } from "firebase/functions";
import { guardCreateInvoice, GuardResult } from "../orchestration/guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  INVOICE_CREATE_STEPS,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";
import { UserRole, MonthCloseStatus } from "@/lib/types";

// ============================================================================
// INVOICE CREATE TYPES
// ============================================================================

export interface CreateInvoiceFromParseInput {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly sourceFileId: string;
}

export interface CreateInvoiceManualInput {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly supplierName: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly vatRate?: number;
}

export interface CreateInvoiceResult {
  readonly invoiceId: string;
  readonly needsReview: boolean;
  readonly confidence: number;
}

export interface InvoiceCreateContext {
  readonly role: UserRole;
  readonly monthCloseStatus: MonthCloseStatus;
}

// ============================================================================
// CREATE INVOICE FROM PARSE ACTION
// ============================================================================

/**
 * Executes invoice creation from parsed file data
 */
export async function executeCreateInvoiceFromParse(
  functions: Functions,
  input: CreateInvoiceFromParseInput,
  context: InvoiceCreateContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<CreateInvoiceResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_invoice_${input.invoiceId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardCreateInvoice(context.role, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "CREATE_INVOICE");

  try {
    // Emit progress
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Creating invoice from parsed data",
      INVOICE_CREATE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    const validatingEvent = createProgressEvent(
      workflowId,
      "Validating invoice data",
      INVOICE_CREATE_STEPS.VALIDATING_DATA,
      { percent: 30 }
    );
    emitter.emit(validatingEvent);
    execution = updateWorkflowProgress(execution, validatingEvent);

    // Call server
    const result = await callCreateInvoiceFromParse(functions, {
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      monthCloseId: input.monthCloseId,
      sourceFileId: input.sourceFileId,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Invoice creation failed");
    }

    // Complete
    const creatingEvent = createProgressEvent(
      workflowId,
      "Creating invoice record",
      INVOICE_CREATE_STEPS.CREATING,
      { percent: 70 }
    );
    emitter.emit(creatingEvent);
    execution = updateWorkflowProgress(execution, creatingEvent);

    const completedEvent = createProgressEvent(
      workflowId,
      "Invoice created",
      INVOICE_CREATE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const invoiceResult: CreateInvoiceResult = {
      invoiceId: result.invoiceId!,
      needsReview: result.needsReview!,
      confidence: result.confidence!,
    };

    execution = completeWorkflow(execution, invoiceResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<CreateInvoiceResult>,
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
      "Invoice creation failed",
      INVOICE_CREATE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<CreateInvoiceResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CREATE INVOICE MANUAL ACTION
// ============================================================================

/**
 * Executes manual invoice creation
 */
export async function executeCreateInvoiceManual(
  functions: Functions,
  input: CreateInvoiceManualInput,
  context: InvoiceCreateContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<CreateInvoiceResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  const workflowId = `wf_invoice_manual_${input.invoiceId}_${Date.now()}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardCreateInvoice(context.role, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "CREATE_INVOICE_MANUAL");

  try {
    // Emit progress
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Creating manual invoice",
      INVOICE_CREATE_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    // Call server
    const result = await callCreateInvoiceManual(functions, {
      invoiceId: input.invoiceId,
      tenantId: input.tenantId,
      monthCloseId: input.monthCloseId,
      supplierName: input.supplierName,
      invoiceNumber: input.invoiceNumber,
      issueDate: input.issueDate,
      totalGross: input.totalGross,
      vatRate: input.vatRate,
    });

    if (!result.success) {
      throw new Error(result.message ?? "Invoice creation failed");
    }

    // Complete
    const completedEvent = createProgressEvent(
      workflowId,
      "Invoice created",
      INVOICE_CREATE_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const invoiceResult: CreateInvoiceResult = {
      invoiceId: result.invoiceId!,
      needsReview: false,
      confidence: 1.0,
    };

    execution = completeWorkflow(execution, invoiceResult);

    return {
      success: true,
      execution: execution as WorkflowExecution<CreateInvoiceResult>,
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
      "Invoice creation failed",
      INVOICE_CREATE_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<CreateInvoiceResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CLOUD FUNCTION CALLS
// ============================================================================

interface CreateInvoiceFromParseParams {
  invoiceId: string;
  tenantId: string;
  monthCloseId: string;
  sourceFileId: string;
}

interface CreateInvoiceManualParams {
  invoiceId: string;
  tenantId: string;
  monthCloseId: string;
  supplierName: string;
  invoiceNumber: string;
  issueDate: string;
  totalGross: number;
  vatRate?: number;
}

interface CreateInvoiceResponse {
  success: boolean;
  invoiceId?: string;
  needsReview?: boolean;
  confidence?: number;
  message?: string;
}

async function callCreateInvoiceFromParse(
  functions: Functions,
  params: CreateInvoiceFromParseParams
): Promise<CreateInvoiceResponse> {
  const callable = httpsCallable<CreateInvoiceFromParseParams, CreateInvoiceResponse>(
    functions,
    "createInvoiceFromParse"
  );
  const result = await callable(params);
  return result.data;
}

async function callCreateInvoiceManual(
  functions: Functions,
  params: CreateInvoiceManualParams
): Promise<CreateInvoiceResponse> {
  const callable = httpsCallable<CreateInvoiceManualParams, CreateInvoiceResponse>(
    functions,
    "createInvoiceManual"
  );
  const result = await callable(params);
  return result.data;
}
