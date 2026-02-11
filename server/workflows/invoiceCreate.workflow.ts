/**
 * Invoice Create Workflow
 * Orchestration layer. Calls logic + persistence.
 *
 * STEP 4 — Invoice Creation
 * - Validate parsed data
 * - Validate initial status
 * - Create invoice with correct initial state
 *
 * INVARIANT: Invoice MUST be derivable from parsed input
 * INVARIANT: NO auto-confirmation unless explicitly allowed
 */

import { Firestore } from "firebase-admin/firestore";
import { WriteContext, createInvoice, createInvoiceBatch, CreateInvoiceInput } from "../persistence/write";
import { readFileAsset, readInvoice } from "../persistence/read";
import { ExtractedInvoice } from "../logic/parsing/extractInvoiceData";
import { REVIEW_THRESHOLD } from "../domain/ledger/invoice";

/**
 * Input for creating an invoice from parsed data
 */
export interface CreateInvoiceFromParseInput {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly sourceFileId: string;
  readonly extractedData: ExtractedInvoice;
}

/**
 * Input for creating an invoice manually
 */
export interface CreateInvoiceManualInput {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly sourceFileId: string;
  readonly supplierName: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly totalGross: number;
  readonly vatRate?: number;
}

/**
 * Result of invoice creation
 */
export interface CreateInvoiceResult {
  readonly success: true;
  readonly invoiceId: string;
  readonly needsReview: boolean;
  readonly confidence: number;
}

/**
 * Error from invoice creation
 */
export interface CreateInvoiceError {
  readonly success: false;
  readonly code: string;
  readonly message: string;
}

export type CreateInvoiceOutcome = CreateInvoiceResult | CreateInvoiceError;

/**
 * Creates an invoice from parsed/extracted data
 *
 * @param db - Firestore instance
 * @param ctx - Write context
 * @param input - Invoice creation input
 * @returns CreateInvoiceOutcome
 */
export async function createInvoiceFromParse(
  db: Firestore,
  ctx: WriteContext,
  input: CreateInvoiceFromParseInput
): Promise<CreateInvoiceOutcome> {
  // Validate required fields from extraction
  const extracted = input.extractedData;

  if (!extracted.invoiceNumber) {
    return { success: false, code: "MISSING_FIELD", message: "Invoice number could not be extracted" };
  }

  if (!extracted.supplierName) {
    return { success: false, code: "MISSING_FIELD", message: "Supplier name could not be extracted" };
  }

  if (extracted.totalGross === null) {
    return { success: false, code: "MISSING_FIELD", message: "Total gross could not be extracted" };
  }

  if (!extracted.issueDate) {
    return { success: false, code: "MISSING_FIELD", message: "Issue date could not be extracted" };
  }

  // Validate input IDs
  if (!input.invoiceId || !input.tenantId || !input.monthCloseId) {
    return { success: false, code: "INVALID_INPUT", message: "invoiceId, tenantId, and monthCloseId are required" };
  }

  // Check source file exists
  const file = await readFileAsset(db, input.tenantId, input.sourceFileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `Source file ${input.sourceFileId} not found` };
  }

  // Check invoice doesn't already exist
  const existing = await readInvoice(db, input.tenantId, input.invoiceId);
  if (existing) {
    return { success: false, code: "ALREADY_EXISTS", message: `Invoice ${input.invoiceId} already exists` };
  }

  // Determine review status
  const confidence = extracted.confidence.overall;
  const needsReview = confidence < REVIEW_THRESHOLD;

  // Create invoice
  await createInvoice(db, ctx, {
    id: input.invoiceId,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    supplierNameRaw: extracted.supplierName,
    invoiceNumber: extracted.invoiceNumber,
    issueDate: extracted.issueDate,
    totalGross: extracted.totalGross,
    extractionConfidence: confidence,
    needsReview,
    sourceFileId: input.sourceFileId,
  });

  return {
    success: true,
    invoiceId: input.invoiceId,
    needsReview,
    confidence,
  };
}

/**
 * Creates an invoice from manual input
 *
 * @param db - Firestore instance
 * @param ctx - Write context
 * @param input - Manual invoice input
 * @returns CreateInvoiceOutcome
 */
export async function createInvoiceManual(
  db: Firestore,
  ctx: WriteContext,
  input: CreateInvoiceManualInput
): Promise<CreateInvoiceOutcome> {
  // Validate required fields
  if (!input.supplierName || input.supplierName.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "supplierName is required" };
  }

  if (!input.invoiceNumber || input.invoiceNumber.trim().length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "invoiceNumber is required" };
  }

  if (!input.issueDate) {
    return { success: false, code: "INVALID_INPUT", message: "issueDate is required" };
  }

  if (typeof input.totalGross !== "number" || input.totalGross < 0) {
    return { success: false, code: "INVALID_INPUT", message: "totalGross must be a non-negative number" };
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.issueDate)) {
    return { success: false, code: "INVALID_INPUT", message: "issueDate must be in YYYY-MM-DD format" };
  }

  // Validate input IDs
  if (!input.invoiceId || !input.tenantId || !input.monthCloseId) {
    return { success: false, code: "INVALID_INPUT", message: "invoiceId, tenantId, and monthCloseId are required" };
  }

  // Check source file exists
  const file = await readFileAsset(db, input.tenantId, input.sourceFileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `Source file ${input.sourceFileId} not found` };
  }

  // Check invoice doesn't already exist
  const existing = await readInvoice(db, input.tenantId, input.invoiceId);
  if (existing) {
    return { success: false, code: "ALREADY_EXISTS", message: `Invoice ${input.invoiceId} already exists` };
  }

  // Manual entries have 100% confidence and don't need review
  const confidence = 100;
  const needsReview = false;

  // Create invoice
  await createInvoice(db, ctx, {
    id: input.invoiceId,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    supplierNameRaw: input.supplierName.trim(),
    invoiceNumber: input.invoiceNumber.trim(),
    issueDate: input.issueDate,
    totalGross: input.totalGross,
    extractionConfidence: confidence,
    needsReview,
    sourceFileId: input.sourceFileId,
  });

  return {
    success: true,
    invoiceId: input.invoiceId,
    needsReview,
    confidence,
  };
}

/**
 * Batch processes a parsed file to create invoices (for multi-invoice PDFs)
 */
export interface BatchCreateInvoicesInput {
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly sourceFileId: string;
  readonly invoices: readonly {
    readonly invoiceId: string;
    readonly extractedData: ExtractedInvoice;
  }[];
}

export interface BatchCreateInvoicesResult {
  readonly success: true;
  readonly created: number;
  readonly skipped: number;
  readonly invoiceIds: readonly string[];
}

export async function batchCreateInvoices(
  db: Firestore,
  ctx: WriteContext,
  input: BatchCreateInvoicesInput
): Promise<BatchCreateInvoicesResult | CreateInvoiceError> {
  // Validate input
  if (!input.tenantId || !input.monthCloseId || !input.sourceFileId) {
    return { success: false, code: "INVALID_INPUT", message: "tenantId, monthCloseId, and sourceFileId are required" };
  }

  if (input.invoices.length === 0) {
    return { success: false, code: "INVALID_INPUT", message: "No invoices provided" };
  }

  // Check source file exists
  const file = await readFileAsset(db, input.tenantId, input.sourceFileId);
  if (!file) {
    return { success: false, code: "NOT_FOUND", message: `Source file ${input.sourceFileId} not found` };
  }

  const toCreate: CreateInvoiceInput[] = [];
  const createdIds: string[] = [];
  let skipped = 0;

  for (const inv of input.invoices) {
    const extracted = inv.extractedData;

    // Skip if essential fields are missing
    if (!extracted.invoiceNumber || !extracted.supplierName || extracted.totalGross === null || !extracted.issueDate) {
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await readInvoice(db, input.tenantId, inv.invoiceId);
    if (existing) {
      skipped++;
      continue;
    }

    const confidence = extracted.confidence.overall;

    toCreate.push({
      id: inv.invoiceId,
      tenantId: input.tenantId,
      monthCloseId: input.monthCloseId,
      supplierNameRaw: extracted.supplierName,
      invoiceNumber: extracted.invoiceNumber,
      issueDate: extracted.issueDate,
      totalGross: extracted.totalGross,
      extractionConfidence: confidence,
      needsReview: confidence < REVIEW_THRESHOLD,
      sourceFileId: input.sourceFileId,
    });

    createdIds.push(inv.invoiceId);
  }

  if (toCreate.length > 0) {
    await createInvoiceBatch(db, ctx, toCreate);
  }

  return {
    success: true,
    created: toCreate.length,
    skipped,
    invoiceIds: createdIds,
  };
}
