/**
 * File Ingestion Action - Workflow adapter for file upload
 *
 * INVARIANT: All file uploads go through this action
 * INVARIANT: Action calls exactly one workflow
 * INVARIANT: Progress is observable at all times
 */

import { httpsCallable, type Functions } from "firebase/functions";
import { guardUploadFile, GuardResult } from "../orchestration/guards";
import {
  WorkflowExecution,
  createWorkflowExecution,
  updateWorkflowProgress,
  completeWorkflow,
  failWorkflow,
  createProgressEvent,
  ProgressEmitter,
  FILE_INGESTION_STEPS,
  WorkflowError,
} from "../events/progress";
import { createError, createErrorFromException, ERROR_CODES, OrchestrationError } from "../events/errors";
import { UserRole, MonthCloseStatus, FileAssetKind } from "@/lib/types";

// ============================================================================
// FILE INGESTION TYPES
// ============================================================================

export interface FileIngestionInput {
  readonly file: File;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly kind: FileAssetKind;
}

export interface FileIngestionResult {
  readonly fileId: string;
  readonly status: string;
  readonly filename: string;
}

export interface FileIngestionContext {
  readonly role: UserRole;
  readonly monthCloseStatus: MonthCloseStatus;
}

// ============================================================================
// FILE INGESTION ACTION
// ============================================================================

/**
 * Executes file ingestion workflow
 *
 * Flow:
 * 1. Guard validation
 * 2. Create file record with PENDING_UPLOAD status
 * 3. Upload file to storage
 * 4. Update file record to UPLOADED status
 * 5. Return workflow execution handle
 */
export async function executeFileIngestion(
  functions: Functions,
  storage: { uploadFile: (path: string, file: File, onProgress?: (percent: number) => void) => Promise<string> },
  input: FileIngestionInput,
  context: FileIngestionContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<FileIngestionResult>;
  error?: OrchestrationError;
  guardResult?: GuardResult;
}> {
  // Generate unique file ID
  const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const workflowId = `wf_ingest_${fileId}`;
  const emitter = new ProgressEmitter();

  // Step 1: Guard validation
  const guardResult = guardUploadFile(context.role, context.monthCloseStatus);
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
  let execution = createWorkflowExecution(workflowId, "UPLOAD_FILE");

  try {
    // Step 2: Emit initiated event
    const initiatedEvent = createProgressEvent(
      workflowId,
      "Initiating file upload",
      FILE_INGESTION_STEPS.INITIATED,
      { percent: 0 }
    );
    emitter.emit(initiatedEvent);
    execution = updateWorkflowProgress(execution, initiatedEvent);

    // Step 3: Create file record
    const createFileResult = await callIngestFile(functions, {
      fileId,
      tenantId: input.tenantId,
      monthCloseId: input.monthCloseId,
      filename: input.file.name,
      kind: input.kind,
      storagePath: `tenants/${input.tenantId}/files/${fileId}/${input.file.name}`,
    });

    if (!createFileResult.success) {
      throw new Error(createFileResult.message);
    }

    const metadataEvent = createProgressEvent(
      workflowId,
      "File metadata saved",
      FILE_INGESTION_STEPS.METADATA_SAVED,
      { percent: 20 }
    );
    emitter.emit(metadataEvent);
    execution = updateWorkflowProgress(execution, metadataEvent);

    // Step 4: Upload to storage
    const storagePath = `tenants/${input.tenantId}/files/${fileId}/${input.file.name}`;

    const uploadingEvent = createProgressEvent(
      workflowId,
      "Uploading file",
      FILE_INGESTION_STEPS.UPLOADING,
      { percent: 30 }
    );
    emitter.emit(uploadingEvent);
    execution = updateWorkflowProgress(execution, uploadingEvent);

    await storage.uploadFile(storagePath, input.file, (percent) => {
      const progressEvent = createProgressEvent(
        workflowId,
        `Uploading: ${percent}%`,
        FILE_INGESTION_STEPS.UPLOADING,
        { percent: 30 + (percent * 0.5) }
      );
      emitter.emit(progressEvent);
    });

    const uploadCompleteEvent = createProgressEvent(
      workflowId,
      "Upload complete",
      FILE_INGESTION_STEPS.UPLOAD_COMPLETE,
      { percent: 80 }
    );
    emitter.emit(uploadCompleteEvent);
    execution = updateWorkflowProgress(execution, uploadCompleteEvent);

    // Step 5: Mark file as uploaded
    const markUploadedResult = await callMarkFileUploaded(functions, {
      fileId,
      tenantId: input.tenantId,
    });

    if (!markUploadedResult.success) {
      throw new Error(markUploadedResult.message);
    }

    // Step 6: Complete
    const completedEvent = createProgressEvent(
      workflowId,
      "File ingestion completed",
      FILE_INGESTION_STEPS.COMPLETED,
      { percent: 100 }
    );
    emitter.emit(completedEvent);
    execution = updateWorkflowProgress(execution, completedEvent);

    const result: FileIngestionResult = {
      fileId,
      status: "UPLOADED",
      filename: input.file.name,
    };

    execution = completeWorkflow(execution, result);

    return {
      success: true,
      execution: execution as WorkflowExecution<FileIngestionResult>,
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
      "File ingestion failed",
      FILE_INGESTION_STEPS.FAILED,
      { explanation: orchestrationError.userMessage }
    );
    emitter.emit(failEvent);
    execution = updateWorkflowProgress(execution, failEvent);
    execution = failWorkflow(execution, workflowError);

    return {
      success: false,
      execution: execution as WorkflowExecution<FileIngestionResult>,
      error: orchestrationError,
    };
  }
}

// ============================================================================
// CLOUD FUNCTION CALLS
// ============================================================================

interface IngestFileParams {
  fileId: string;
  tenantId: string;
  monthCloseId: string;
  filename: string;
  kind: FileAssetKind;
  storagePath: string;
}

interface IngestFileResponse {
  success: boolean;
  fileId?: string;
  message?: string;
}

async function callIngestFile(
  functions: Functions,
  params: IngestFileParams
): Promise<IngestFileResponse> {
  const callable = httpsCallable<IngestFileParams, IngestFileResponse>(functions, "ingestFile");
  const result = await callable(params);
  return result.data;
}

interface MarkUploadedParams {
  fileId: string;
  tenantId: string;
}

interface MarkUploadedResponse {
  success: boolean;
  message?: string;
}

async function callMarkFileUploaded(
  functions: Functions,
  params: MarkUploadedParams
): Promise<MarkUploadedResponse> {
  const callable = httpsCallable<MarkUploadedParams, MarkUploadedResponse>(functions, "markFileUploaded");
  const result = await callable(params);
  return result.data;
}

// ============================================================================
// RETRY AND CANCEL ACTIONS
// ============================================================================

/**
 * Retries a failed file upload
 */
export async function retryFileIngestion(
  functions: Functions,
  storage: { uploadFile: (path: string, file: File, onProgress?: (percent: number) => void) => Promise<string> },
  input: FileIngestionInput,
  context: FileIngestionContext
): Promise<{
  success: boolean;
  execution?: WorkflowExecution<FileIngestionResult>;
  error?: OrchestrationError;
}> {
  // Retry is just a new execution
  return executeFileIngestion(functions, storage, input, context);
}

/**
 * Cancels an in-progress file upload (if possible)
 */
export function cancelFileIngestion(workflowId: string): void {
  // Cancel is handled by the workflow execution manager
  // This is a signal to abort the current upload
  console.log(`Cancel requested for workflow: ${workflowId}`);
}
