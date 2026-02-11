/**
 * Ingest File Workflow
 * Orchestration layer. Calls persistence + state machine.
 *
 * STEP 1 — File Ingestion
 * - Accept file reference
 * - Persist file metadata
 * - Set status: PENDING_UPLOAD -> UPLOADED
 *
 * INVARIANT: NO parsing, NO assumptions about contents
 * INVARIANT: This step exists only to say: "A file now exists."
 */

import { Firestore } from "firebase-admin/firestore";
import { WriteContext, createFileAsset, updateFileAsset } from "../persistence/write";
import { readFileAsset } from "../persistence/read";
import { assertFileAssetTransition, assertFileAssetNotTerminal, FileAssetStatus } from "../state/statusMachine";

/**
 * File kinds supported for ingestion
 */
export const FILE_KINDS = ["BANK_CSV", "INVOICE_PDF", "EXPORT"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

/**
 * Input for file ingestion
 */
export interface IngestFileInput {
  readonly fileId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly kind: FileKind;
  readonly filename: string;
  readonly storagePath: string;
}

/**
 * Result of file ingestion
 */
export interface IngestFileResult {
  readonly success: true;
  readonly fileId: string;
  readonly status: string;
}

/**
 * Error from file ingestion
 */
export interface IngestFileError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type IngestFileOutcome = IngestFileResult | IngestFileError;

/**
 * Creates a new file asset in PENDING_UPLOAD status
 *
 * @param db - Firestore instance
 * @param ctx - Write context with actor and timestamp
 * @param input - File metadata
 * @returns IngestFileOutcome
 */
export async function ingestFile(
  db: Firestore,
  ctx: WriteContext,
  input: IngestFileInput
): Promise<IngestFileOutcome> {
  // Validate input
  if (!input.fileId || input.fileId.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "fileId is required" };
  }

  if (!input.tenantId || input.tenantId.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "tenantId is required" };
  }

  if (!input.monthCloseId || input.monthCloseId.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "monthCloseId is required" };
  }

  if (!input.filename || input.filename.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "filename is required" };
  }

  if (!input.storagePath || input.storagePath.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "storagePath is required" };
  }

  if (!FILE_KINDS.includes(input.kind)) {
    return { success: false, code: "INVALID_INPUT", message: `Invalid file kind: ${input.kind}` };
  }

  // Check if file already exists
  const existing = await readFileAsset(db, input.tenantId, input.fileId);
  if (existing) {
    return { success: false, code: "ALREADY_EXISTS", message: `File ${input.fileId} already exists` };
  }

  // Create file asset in PENDING_UPLOAD status
  await createFileAsset(db, ctx, {
    id: input.fileId,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    kind: input.kind,
    filename: input.filename,
    storagePath: input.storagePath,
    status: "PENDING_UPLOAD",
    parseStatus: "PENDING",
  });

  return {
    success: true,
    fileId: input.fileId,
    status: "PENDING_UPLOAD",
  };
}

/**
 * Marks a file as uploaded (PENDING_UPLOAD -> UPLOADED)
 *
 * @param db - Firestore instance
 * @param ctx - Write context
 * @param tenantId - Tenant ID
 * @param fileId - File ID
 * @param sha256 - Optional SHA256 hash of file content
 * @returns IngestFileOutcome
 */
export async function markFileUploaded(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  fileId: string,
  sha256?: string
): Promise<IngestFileOutcome> {
  // Read current state
  const file = await readFileAsset(db, tenantId, fileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `File ${fileId} not found` };
  }

  // Validate transition
  try {
    assertFileAssetNotTerminal(file.status as FileAssetStatus);
    assertFileAssetTransition(file.status as FileAssetStatus, "UPLOADED");
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      message: err instanceof Error ? err.message : "Invalid transition",
    };
  }

  // Update to UPLOADED
  await updateFileAsset(db, ctx, tenantId, fileId, {
    status: "UPLOADED",
    sha256,
  });

  return {
    success: true,
    fileId,
    status: "UPLOADED",
  };
}

/**
 * Marks a file as deleted (any non-terminal -> DELETED)
 *
 * @param db - Firestore instance
 * @param ctx - Write context
 * @param tenantId - Tenant ID
 * @param fileId - File ID
 * @returns IngestFileOutcome
 */
export async function markFileDeleted(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  fileId: string
): Promise<IngestFileOutcome> {
  // Read current state
  const file = await readFileAsset(db, tenantId, fileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `File ${fileId} not found` };
  }

  // Validate transition
  try {
    assertFileAssetNotTerminal(file.status as FileAssetStatus);
    assertFileAssetTransition(file.status as FileAssetStatus, "DELETED");
  } catch (err) {
    return {
      success: false,
      code: "INVALID_TRANSITION",
      message: err instanceof Error ? err.message : "Invalid transition",
    };
  }

  // Update to DELETED
  await updateFileAsset(db, ctx, tenantId, fileId, {
    status: "DELETED",
  });

  return {
    success: true,
    fileId,
    status: "DELETED",
  };
}
