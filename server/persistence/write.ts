/**
 * Persistence - Write Operations
 * IO layer. All Firestore writes live here.
 *
 * INVARIANT: This module is the ONLY place that writes to Firestore
 * INVARIANT: All writes use server timestamps for consistency
 * INVARIANT: All writes include actor ID for audit trail
 */

import { Firestore, Timestamp } from "firebase-admin/firestore";
import {
  StoredMonthClose,
  StoredFileAsset,
  StoredBankTx,
  StoredInvoice,
  StoredMatch,
} from "./read";

// ============================================================================
// CONTEXT
// ============================================================================

/**
 * Write context - injected timestamp and actor for determinism
 */
export interface WriteContext {
  readonly actorId: string; // UID of the actor performing the write
  readonly now: Timestamp; // Injected timestamp for determinism
}

// ============================================================================
// MONTH CLOSE WRITES
// ============================================================================

export interface CreateMonthCloseInput {
  id: string;
  tenantId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  status: string;
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  openExceptionsCount: number;
  highExceptionsCount: number;
  notes?: string;
}

export async function createMonthClose(
  db: Firestore,
  ctx: WriteContext,
  input: CreateMonthCloseInput
): Promise<void> {
  const doc: StoredMonthClose = {
    ...input,
    createdBy: ctx.actorId,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    updatedBy: ctx.actorId,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("monthCloses")
    .doc(input.id)
    .set(doc);
}

export interface UpdateMonthCloseInput {
  status?: string;
  bankTotal?: number;
  invoiceTotal?: number;
  diff?: number;
  openExceptionsCount?: number;
  highExceptionsCount?: number;
  notes?: string;
  finalizedAt?: Timestamp;
  finalizedBy?: string;
}

export async function updateMonthClose(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  monthCloseId: string,
  input: UpdateMonthCloseInput
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: ctx.now,
    updatedBy: ctx.actorId,
  };

  // Remove undefined values
  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  }

  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("monthCloses")
    .doc(monthCloseId)
    .update(updates);
}

// ============================================================================
// FILE ASSET WRITES
// ============================================================================

export interface CreateFileAssetInput {
  id: string;
  tenantId: string;
  monthCloseId: string;
  kind: string;
  filename: string;
  storagePath: string;
  status: string;
  parseStatus?: string;
  notes?: string;
}

export async function createFileAsset(
  db: Firestore,
  ctx: WriteContext,
  input: CreateFileAssetInput
): Promise<void> {
  const doc: StoredFileAsset = {
    ...input,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("fileAssets")
    .doc(input.id)
    .set(doc);
}

export interface UpdateFileAssetInput {
  status?: string;
  parseStatus?: string;
  parseError?: string | null;
  sha256?: string;
  parsedAt?: Timestamp;
  parsedBy?: string;
}

export async function updateFileAsset(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  fileAssetId: string,
  input: UpdateFileAssetInput
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: ctx.now,
  };

  // Remove undefined values
  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  }

  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("fileAssets")
    .doc(fileAssetId)
    .update(updates);
}

// ============================================================================
// BANK TX WRITES
// ============================================================================

export interface CreateBankTxInput {
  id: string;
  tenantId: string;
  monthCloseId: string;
  bookingDate: string;
  amount: number;
  descriptionRaw: string;
  fingerprint: string;
  sourceFileId: string;
  counterpartyRaw?: string;
  referenceRaw?: string;
}

export async function createBankTx(
  db: Firestore,
  ctx: WriteContext,
  input: CreateBankTxInput
): Promise<void> {
  const doc: StoredBankTx = {
    ...input,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.actorId,
    updatedBy: ctx.actorId,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("bankTx")
    .doc(input.id)
    .set(doc);
}

export async function createBankTxBatch(
  db: Firestore,
  ctx: WriteContext,
  items: CreateBankTxInput[]
): Promise<void> {
  const batch = db.batch();

  for (const input of items) {
    const doc: StoredBankTx = {
      ...input,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
      schemaVersion: 1,
    };

    const ref = db
      .collection("tenants")
      .doc(input.tenantId)
      .collection("bankTx")
      .doc(input.id);

    batch.set(ref, doc);
  }

  await batch.commit();
}

// ============================================================================
// INVOICE WRITES
// ============================================================================

export interface CreateInvoiceInput {
  id: string;
  tenantId: string;
  monthCloseId: string;
  supplierNameRaw: string;
  invoiceNumber: string;
  issueDate: string;
  totalGross: number;
  extractionConfidence: number;
  needsReview: boolean;
  sourceFileId: string;
  supplierId?: string;
}

export async function createInvoice(
  db: Firestore,
  ctx: WriteContext,
  input: CreateInvoiceInput
): Promise<void> {
  const doc: StoredInvoice = {
    ...input,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.actorId,
    updatedBy: ctx.actorId,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("invoices")
    .doc(input.id)
    .set(doc);
}

export async function createInvoiceBatch(
  db: Firestore,
  ctx: WriteContext,
  items: CreateInvoiceInput[]
): Promise<void> {
  const batch = db.batch();

  for (const input of items) {
    const doc: StoredInvoice = {
      ...input,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
      schemaVersion: 1,
    };

    const ref = db
      .collection("tenants")
      .doc(input.tenantId)
      .collection("invoices")
      .doc(input.id);

    batch.set(ref, doc);
  }

  await batch.commit();
}

// ============================================================================
// MATCH WRITES
// ============================================================================

export interface CreateMatchInput {
  id: string;
  tenantId: string;
  monthCloseId: string;
  bankTxIds: string[];
  invoiceIds: string[];
  matchType: string;
  score: number;
  status: string;
  explanationKey: string;
  explanationParams: Record<string, string | number>;
}

export async function createMatch(
  db: Firestore,
  ctx: WriteContext,
  input: CreateMatchInput
): Promise<void> {
  const doc: StoredMatch = {
    ...input,
    createdAt: ctx.now,
    updatedAt: ctx.now,
    createdBy: ctx.actorId,
    updatedBy: ctx.actorId,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("matches")
    .doc(input.id)
    .set(doc);
}

export async function createMatchBatch(
  db: Firestore,
  ctx: WriteContext,
  items: CreateMatchInput[]
): Promise<void> {
  const batch = db.batch();

  for (const input of items) {
    const doc: StoredMatch = {
      ...input,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actorId,
      updatedBy: ctx.actorId,
      schemaVersion: 1,
    };

    const ref = db
      .collection("tenants")
      .doc(input.tenantId)
      .collection("matches")
      .doc(input.id);

    batch.set(ref, doc);
  }

  await batch.commit();
}

export interface UpdateMatchInput {
  status?: string;
  reason?: string;
  confirmedBy?: string;
  confirmedAt?: Timestamp;
  finalizedBy?: string;
}

export async function updateMatch(
  db: Firestore,
  ctx: WriteContext,
  tenantId: string,
  matchId: string,
  input: UpdateMatchInput
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...input,
    updatedAt: ctx.now,
    updatedBy: ctx.actorId,
  };

  // Remove undefined values
  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  }

  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .doc(matchId)
    .update(updates);
}

// ============================================================================
// EVENTS WRITES
// ============================================================================

export interface CreateEventInput {
  id: string;
  tenantId: string;
  type: string;
  occurredAt: string;
  recordedAt: string;
  monthKey: string;
  deterministicId: string;
  payload: Record<string, unknown>;
}

export async function createEvent(
  db: Firestore,
  ctx: WriteContext,
  input: CreateEventInput
): Promise<void> {
  const doc = {
    ...input,
    schemaVersion: 1,
    createdAt: ctx.now,
    createdBy: ctx.actorId,
    updatedAt: ctx.now,
    updatedBy: ctx.actorId,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("events")
    .doc(input.id)
    .set(doc);
}

// ============================================================================
// PERIOD WRITES
// ============================================================================

export interface UpsertPeriodInput {
  tenantId: string;
  monthKey: string;
  status: "OPEN" | "FINALIZED";
  finalizedAt?: Timestamp;
  closeConfig?: { asOfDays: number[] };
  periodLockHash?: string;
}

export async function upsertPeriod(
  db: Firestore,
  ctx: WriteContext,
  input: UpsertPeriodInput
): Promise<void> {
  const doc = {
    id: input.monthKey,
    tenantId: input.tenantId,
    status: input.status,
    finalizedAt: input.finalizedAt,
    closeConfig: input.closeConfig,
    periodLockHash: input.periodLockHash,
    createdAt: ctx.now,
    createdBy: ctx.actorId,
    updatedAt: ctx.now,
    updatedBy: ctx.actorId,
    schemaVersion: 1,
  };

  await db
    .collection("tenants")
    .doc(input.tenantId)
    .collection("periods")
    .doc(input.monthKey)
    .set(doc, { merge: true });
}

// ============================================================================
// READMODEL WRITES
// ============================================================================

export async function writeReadmodel(
  db: Firestore,
  tenantId: string,
  modelName: string,
  docId: string,
  data: FirebaseFirestore.DocumentData
): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc(modelName)
    .collection(docId)
    .doc("snapshot")
    .set(data);
}

export async function writeReadmodelDoc(
  db: Firestore,
  tenantId: string,
  modelName: string,
  docId: string,
  data: FirebaseFirestore.DocumentData
): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc(modelName)
    .collection("items")
    .doc(docId)
    .set(data);
}

export async function writeAuditorReplaySnapshot(
  db: Firestore,
  tenantId: string,
  monthKey: string,
  asOfDateKey: string,
  data: FirebaseFirestore.DocumentData
): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc("auditorReplay")
    .collection(monthKey)
    .doc(asOfDateKey)
    .set(data);
}

// ============================================================================
// EXPORT WRITES
// ============================================================================

export async function writeExportArtifact(
  db: Firestore,
  tenantId: string,
  monthKey: string,
  artifactId: "ledgerCsv" | "summaryPdf",
  data: FirebaseFirestore.DocumentData
): Promise<void> {
  await db
    .collection("tenants")
    .doc(tenantId)
    .collection("exports")
    .doc(monthKey)
    .collection("artifacts")
    .doc(artifactId)
    .set(data);
}

// ============================================================================
// JOB WRITES
// ============================================================================

export interface CreateJobInput {
  id: string;
  tenantId: string;
  monthKey: string;
  action: string;
  periodLockHash: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  outputsRefs?: Record<string, string>;
  errorCode?: string;
  errorMessage?: string;
}

export async function createJob(
  db: Firestore,
  ctx: WriteContext,
  input: CreateJobInput
): Promise<void> {
  const doc: Record<string, unknown> = {
    id: input.id,
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    action: input.action,
    status: input.status,
    periodLockHash: input.periodLockHash,
    startedAt: ctx.now,
    completedAt: input.status === "COMPLETED" ? ctx.now : undefined,
    outputsRefs: input.outputsRefs,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    schemaVersion: 1,
  };

  for (const key of Object.keys(doc)) {
    if (doc[key] === undefined) {
      delete doc[key];
    }
  }

  await db.collection("jobs").doc(input.id).set(doc);
}

export async function updateJob(
  db: Firestore,
  ctx: WriteContext,
  jobId: string,
  input: {
    status?: "RUNNING" | "COMPLETED" | "FAILED";
    outputsRefs?: Record<string, string>;
    errorCode?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const updates: Record<string, unknown> = {
    ...input,
    completedAt: input.status === "COMPLETED" ? ctx.now : undefined,
    updatedAt: ctx.now,
  };

  for (const key of Object.keys(updates)) {
    if (updates[key] === undefined) {
      delete updates[key];
    }
  }

  await db.collection("jobs").doc(jobId).update(updates);
}
