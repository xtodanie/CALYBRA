/**
 * Ingestion Pipeline - Server-Authoritative Job Processing
 *
 * INVARIANTS:
 * - Jobs are server-only writes
 * - Processing is deterministic
 * - Idempotent by fingerprint/externalId
 * - Tenant-isolated in all queries
 * - State machine compliant
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as functions from "firebase-functions/v1";
import * as crypto from "crypto";

// =============================================================================
// JOB STATUS MACHINE
// =============================================================================

enum JobStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  PARSED = "PARSED",
  MATCHED = "MATCHED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

const JOB_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.PROCESSING, JobStatus.FAILED],
  [JobStatus.PROCESSING]: [JobStatus.PARSED, JobStatus.FAILED],
  [JobStatus.PARSED]: [JobStatus.MATCHED, JobStatus.FAILED],
  [JobStatus.MATCHED]: [JobStatus.COMPLETED, JobStatus.FAILED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.FAILED]: [],
};

function canTransition(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// TYPES
// =============================================================================

interface UserProfile {
  uid: string;
  tenantId: string;
  role: string;
}

interface CreateJobInput {
  fileAssetId: string;
  monthCloseId: string;
}

interface JobDocument {
  id: string;
  tenantId: string;
  monthCloseId: string;
  type: "PARSE_BANK_CSV" | "PARSE_INVOICE_PDF";
  status: JobStatus;
  refFileId: string;
  progress: { stepKey: string; pct: number };
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  schemaVersion: number;
  error?: { code: string; messageKey: string };
  completedAt?: FirebaseFirestore.Timestamp;
}

interface FileAssetDocument {
  id: string;
  tenantId: string;
  monthCloseId: string;
  kind: "BANK_CSV" | "INVOICE_PDF" | "EXPORT";
  filename: string;
  storagePath: string;
  status: string;
  parseStatus: string;
  sha256?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

async function loadUser(uid: string): Promise<UserProfile> {
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(uid).get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data()!;
  return {
    uid,
    tenantId: userData.tenantId,
    role: userData.role,
  };
}

function generateFingerprint(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Generate deterministic document ID from content.
 * Uses first 20 chars of SHA256 for Firestore-friendly ID.
 */
function generateDeterministicId(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").substring(0, 20);
}

// =============================================================================
// CREATE JOB CALLABLE
// =============================================================================

/**
 * Creates a job for processing an uploaded file.
 * This is the ONLY way jobs should be created - via this callable.
 */
export const createJob = functions.https.onCall(
  async (
    data: CreateJobInput,
    context: functions.https.CallableContext
  ) => {
    // 1. Authenticate
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const { fileAssetId, monthCloseId } = data || {};

    if (!fileAssetId || !monthCloseId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "fileAssetId and monthCloseId are required."
      );
    }

    // 2. Load user and validate tenant membership
    const user = await loadUser(context.auth.uid);

    const db = getFirestore();

    // 3. Load fileAsset and validate tenant isolation
    const fileAssetRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("fileAssets")
      .doc(fileAssetId);

    const fileAssetSnap = await fileAssetRef.get();

    if (!fileAssetSnap.exists) {
      throw new functions.https.HttpsError("not-found", "File asset not found.");
    }

    const fileAsset = fileAssetSnap.data() as FileAssetDocument;

    if (fileAsset.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to access this file."
      );
    }

    // 4. Validate monthClose is not terminal
    const monthCloseRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("monthCloses")
      .doc(monthCloseId);

    const monthCloseSnap = await monthCloseRef.get();

    if (!monthCloseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Month close not found.");
    }

    const monthClose = monthCloseSnap.data()!;
    if (monthClose.status === "FINALIZED") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Cannot create job for finalized month."
      );
    }

    // 5. Determine job type from file kind
    let jobType: "PARSE_BANK_CSV" | "PARSE_INVOICE_PDF";
    if (fileAsset.kind === "BANK_CSV") {
      jobType = "PARSE_BANK_CSV";
    } else if (fileAsset.kind === "INVOICE_PDF") {
      jobType = "PARSE_INVOICE_PDF";
    } else {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Cannot process file of kind: ${fileAsset.kind}`
      );
    }

    // 6. Create job document (in root jobs collection per schema)
    const now = FieldValue.serverTimestamp();
    const jobRef = db.collection("jobs").doc();

    const jobDoc = {
      id: jobRef.id,
      tenantId: user.tenantId,
      monthCloseId,
      type: jobType,
      status: JobStatus.PENDING,
      refFileId: fileAssetId,
      progress: { stepKey: "jobs.steps.queued", pct: 0 },
      error: null,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
      schemaVersion: 1,
    };

    await jobRef.set(jobDoc);

    functions.logger.info(`Job created: ${jobRef.id} for file ${fileAssetId}`);

    return { jobId: jobRef.id, status: "ok" };
  }
);

// =============================================================================
// RETRY JOB CALLABLE
// =============================================================================

interface RetryJobInput {
  jobId: string;
}

/**
 * Retries a failed job by resetting status to PENDING and re-running the pipeline.
 * This allows debugging and recovery without creating new job documents.
 */
export const retryJob = functions.https.onCall(
  async (
    data: RetryJobInput,
    context: functions.https.CallableContext
  ) => {
    // 1. Authenticate
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const { jobId } = data || {};

    if (!jobId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "jobId is required."
      );
    }

    // 2. Load user
    const user = await loadUser(context.auth.uid);
    const db = getFirestore();

    // 3. Load and validate job
    const jobRef = db.collection("jobs").doc(jobId);
    const jobSnap = await jobRef.get();

    if (!jobSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Job not found.");
    }

    const jobData = jobSnap.data() as JobDocument;

    // 4. Validate tenant isolation
    if (jobData.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You do not have permission to access this job."
      );
    }

    // 5. Validate job is in FAILED state
    if (jobData.status !== JobStatus.FAILED) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Cannot retry job in ${jobData.status} status. Only FAILED jobs can be retried.`
      );
    }

    // 6. Reset job to PENDING (will be picked up and processed)
    // Note: We can't re-trigger onCreate, so we run the pipeline directly
    await jobRef.update({
      status: JobStatus.PENDING,
      error: null,
      progress: { stepKey: "jobs.steps.queued", pct: 0 },
      updatedAt: FieldValue.serverTimestamp(),
      retryCount: FieldValue.increment(1),
    });

    functions.logger.info(`Job ${jobId} reset to PENDING for retry`);

    // 7. Run the pipeline directly (cannot rely on onCreate for retry)
    try {
      await runJobPipeline(db, jobId, jobData);
      return { jobId, status: "ok", message: "Job retry completed successfully" };
    } catch (error) {
      functions.logger.error(`Job ${jobId} retry failed:`, error);
      throw new functions.https.HttpsError(
        "internal",
        `Job retry failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
);

// =============================================================================
// CORE PIPELINE LOGIC (Shared by onCreate trigger and retryJob)
// =============================================================================

async function runJobPipeline(
  db: FirebaseFirestore.Firestore,
  jobId: string,
  jobData: JobDocument
): Promise<void> {
  const jobRef = db.collection("jobs").doc(jobId);
  const { tenantId, monthCloseId, refFileId, type } = jobData;

  try {
    // ========================================
    // STEP A: Transition PENDING → PROCESSING
    // ========================================
    await transitionJob(jobRef, JobStatus.PENDING, JobStatus.PROCESSING, {
      stepKey: "jobs.steps.downloading",
      pct: 10,
    });

    // ========================================
    // STEP B: Load and validate file
    // ========================================
    const fileAssetRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("fileAssets")
      .doc(refFileId);

    const fileAssetSnap = await fileAssetRef.get();
    if (!fileAssetSnap.exists) {
      throw new Error("File asset not found");
    }

    const fileAsset = fileAssetSnap.data() as FileAssetDocument;

    // Validate tenant isolation
    if (fileAsset.tenantId !== tenantId) {
      throw new Error("Tenant isolation violation");
    }

    // Download file from Storage
    const fileContent = await downloadFile(fileAsset.storagePath);

    await updateJobProgress(jobRef, { stepKey: "jobs.steps.preparing", pct: 30 });

    // ========================================
    // STEP C: Parse file
    // ========================================
    if (type === "PARSE_BANK_CSV") {
      await processBankCsv(
        db,
        jobRef,
        jobId,
        tenantId,
        monthCloseId,
        refFileId,
        fileContent
      );
    } else if (type === "PARSE_INVOICE_PDF") {
      await processInvoicePdf(
        db,
        jobRef,
        jobId,
        tenantId,
        monthCloseId,
        refFileId,
        fileContent
      );
    }

    // Transition PROCESSING → PARSED
    await transitionJob(jobRef, JobStatus.PROCESSING, JobStatus.PARSED, {
      stepKey: "jobs.steps.parsed",
      pct: 50,
    });

    // ========================================
    // STEP D: Run matching
    // ========================================
    await runMatching(db, jobRef, jobId, tenantId, monthCloseId);

    // Transition PARSED → MATCHED
    await transitionJob(jobRef, JobStatus.PARSED, JobStatus.MATCHED, {
      stepKey: "jobs.steps.matched",
      pct: 80,
    });

    // ========================================
    // STEP E: Recompute month close summary
    // ========================================
    await recomputeMonthCloseSummary(db, tenantId, monthCloseId);

    // ========================================
    // STEP F: Final transition MATCHED → COMPLETED
    // ========================================
    await transitionJob(jobRef, JobStatus.MATCHED, JobStatus.COMPLETED, {
      stepKey: "jobs.steps.completed",
      pct: 100,
    });

    // Update file asset parse status
    await fileAssetRef.update({
      parseStatus: "PARSED",
      parsedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    functions.logger.info(`Job ${jobId} completed successfully`);
  } catch (error) {
    functions.logger.error(`Job ${jobId} failed:`, error);

    // Transition to FAILED
    await jobRef.update({
      status: JobStatus.FAILED,
      error: {
        code: "JOB_EXECUTION_FAILED",
        messageKey: "jobs.errors.GENERIC",
      },
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update file asset parse status
    const fileAssetRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("fileAssets")
      .doc(refFileId);

    await fileAssetRef.update({
      parseStatus: "FAILED",
      parseError: error instanceof Error ? error.message : "Unknown error",
      updatedAt: FieldValue.serverTimestamp(),
    });

    throw error; // Re-throw for caller to handle
  }
}

// =============================================================================
// PROCESS JOB TRIGGER
// =============================================================================

/**
 * Triggered when a job document is created.
 * Runs the deterministic ingestion pipeline via shared runJobPipeline.
 */
export const processJob = functions.firestore
  .document("jobs/{jobId}")
  .onCreate(async (snap, context) => {
    const { jobId } = context.params;
    const db = getFirestore();
    const jobData = snap.data() as JobDocument;

    functions.logger.info(`Processing job ${jobId} of type ${jobData.type}`);

    // Delegate to shared pipeline logic
    await runJobPipeline(db, jobId, jobData);
  });

// =============================================================================
// PIPELINE STEPS
// =============================================================================

async function transitionJob(
  jobRef: FirebaseFirestore.DocumentReference,
  from: JobStatus,
  to: JobStatus,
  progress: { stepKey: string; pct: number }
): Promise<void> {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid job transition: ${from} → ${to}`);
  }

  await jobRef.update({
    status: to,
    progress,
    updatedAt: FieldValue.serverTimestamp(),
    ...(to === JobStatus.COMPLETED && { completedAt: FieldValue.serverTimestamp() }),
  });
}

async function updateJobProgress(
  jobRef: FirebaseFirestore.DocumentReference,
  progress: { stepKey: string; pct: number }
): Promise<void> {
  await jobRef.update({
    progress,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

async function downloadFile(storagePath: string): Promise<string> {
  // Use explicit bucket name to ensure emulator connectivity
  const bucket = getStorage().bucket("studio-5801368156-a6af7.appspot.com");
  const file = bucket.file(storagePath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`File not found in storage: ${storagePath}`);
  }

  const [content] = await file.download();
  return content.toString("utf-8");
}

// =============================================================================
// BANK CSV PROCESSING
// =============================================================================

interface BankTxLine {
  rowIndex: number;
  bookingDate: string;
  amount: number;
  description: string;
  counterparty: string | null;
  reference: string | null;
}

async function processBankCsv(
  db: FirebaseFirestore.Firestore,
  jobRef: FirebaseFirestore.DocumentReference,
  jobId: string,
  tenantId: string,
  monthCloseId: string,
  sourceFileId: string,
  content: string
): Promise<void> {
  // Parse CSV
  const transactions = parseBankCsv(content);

  if (transactions.length === 0) {
    throw new Error("No valid transactions found in CSV");
  }

  functions.logger.info(`Parsed ${transactions.length} transactions from CSV`);

  // Create bankTx documents with deterministic IDs (idempotent)
  const batch = db.batch();
  const bankTxCollection = db
    .collection("tenants")
    .doc(tenantId)
    .collection("bankTx");

  for (const tx of transactions) {
    // Generate deterministic ID and fingerprint
    const fingerprintContent = `${tenantId}:${tx.bookingDate}:${tx.amount}:${tx.description}`;
    const fingerprint = generateFingerprint(fingerprintContent);
    const docId = generateDeterministicId(fingerprintContent);

    // Use deterministic ID - set will overwrite if exists (idempotent)
    const txRef = bankTxCollection.doc(docId);
    const now = FieldValue.serverTimestamp();

    batch.set(txRef, {
      id: docId,
      tenantId,
      monthCloseId,
      bookingDate: tx.bookingDate,
      amount: tx.amount,
      descriptionRaw: tx.description,
      counterpartyRaw: tx.counterparty,
      referenceRaw: tx.reference,
      fingerprint,
      sourceFileId,
      sourceJobId: jobId,
      createdAt: now,
      updatedAt: now,
      createdBy: "system",
      updatedBy: "system",
      schemaVersion: 1,
    });
  }

  await batch.commit();
  functions.logger.info(`Created/updated ${transactions.length} bankTx documents`);
}

function parseBankCsv(content: string): BankTxLine[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header and one data row");
  }

  // Detect delimiter
  const delimiter = detectDelimiter(lines[0]);

  // Parse header and detect columns
  const header = parseRow(lines[0], delimiter);
  const mapping = detectColumnMapping(header);

  // Parse data rows
  const transactions: BankTxLine[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i], delimiter);

    if (row.length < 3) continue;

    try {
      const dateStr = row[mapping.date]?.trim();
      const amountStr = row[mapping.amount]?.trim();
      const description = row[mapping.description]?.trim() || "";

      if (!dateStr || !amountStr) continue;

      const bookingDate = parseDate(dateStr);
      const amount = parseAmount(amountStr);

      if (!bookingDate || isNaN(amount)) continue;

      transactions.push({
        rowIndex: i,
        bookingDate,
        amount,
        description,
        counterparty: mapping.counterparty !== undefined ? row[mapping.counterparty]?.trim() || null : null,
        reference: mapping.reference !== undefined ? row[mapping.reference]?.trim() || null : null,
      });
    } catch {
      continue;
    }
  }

  return transactions;
}

function detectDelimiter(header: string): string {
  const delimiters = [",", ";", "\t", "|"];
  let maxCount = 0;
  let detected = ",";

  for (const d of delimiters) {
    const count = (header.match(new RegExp(`\\${d}`, "g")) || []).length;
    if (count > maxCount) {
      maxCount = count;
      detected = d;
    }
  }

  return detected;
}

function parseRow(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

interface ColumnMapping {
  date: number;
  amount: number;
  description: number;
  counterparty?: number;
  reference?: number;
}

function detectColumnMapping(header: string[]): ColumnMapping {
  const normalized = header.map((h) => h.toLowerCase().trim());

  const datePatterns = ["date", "fecha", "datum", "booking", "value"];
  const amountPatterns = ["amount", "importe", "monto", "betrag", "sum"];
  const descPatterns = ["description", "descripcion", "concept", "details", "concepto"];
  const counterpartyPatterns = ["counterparty", "payee", "beneficiary", "ordenante"];
  const refPatterns = ["reference", "referencia", "ref"];

  const findCol = (patterns: string[]): number => {
    for (let i = 0; i < normalized.length; i++) {
      if (patterns.some((p) => normalized[i].includes(p))) {
        return i;
      }
    }
    return -1;
  };

  const dateCol = findCol(datePatterns);
  const amountCol = findCol(amountPatterns);
  const descCol = findCol(descPatterns);
  const counterpartyCol = findCol(counterpartyPatterns);
  const refCol = findCol(refPatterns);

  // Fallback to positional if detection fails
  return {
    date: dateCol >= 0 ? dateCol : 0,
    amount: amountCol >= 0 ? amountCol : 2,
    description: descCol >= 0 ? descCol : 1,
    counterparty: counterpartyCol >= 0 ? counterpartyCol : undefined,
    reference: refCol >= 0 ? refCol : undefined,
  };
}

function parseDate(dateStr: string): string | null {
  // Try common formats
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
    /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format.source.startsWith("^(\\d{4})")) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      } else {
        return `${match[3]}-${match[2]}-${match[1]}`;
      }
    }
  }

  // Try Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return null;
}

function parseAmount(amountStr: string): number {
  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[€$£¥\s]/g, "");

  // Handle European format (1.234,56) vs US format (1,234.56)
  const hasCommaDecimal = /,\d{2}$/.test(cleaned);
  const hasDotDecimal = /\.\d{2}$/.test(cleaned);

  if (hasCommaDecimal && !hasDotDecimal) {
    // European format
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (!hasCommaDecimal && hasDotDecimal) {
    // US format
    cleaned = cleaned.replace(/,/g, "");
  } else {
    // Ambiguous - try to detect
    cleaned = cleaned.replace(/,/g, "");
  }

  return parseFloat(cleaned);
}

// =============================================================================
// INVOICE PDF PROCESSING
// =============================================================================

async function processInvoicePdf(
  db: FirebaseFirestore.Firestore,
  jobRef: FirebaseFirestore.DocumentReference,
  jobId: string,
  tenantId: string,
  monthCloseId: string,
  sourceFileId: string,
  content: string
): Promise<void> {
  // For PDFs, content is pre-extracted text (from OCR or text layer)
  // In a real implementation, this would call an AI parser
  const invoiceData = extractInvoiceData(content);

  if (!invoiceData.totalGross || !invoiceData.invoiceNumber) {
    throw new Error("Could not extract required invoice data");
  }

  // Generate deterministic ID and fingerprint
  const fingerprintContent = `${tenantId}:${invoiceData.invoiceNumber}:${invoiceData.totalGross}`;
  const fingerprint = generateFingerprint(fingerprintContent);
  const docId = generateDeterministicId(fingerprintContent);

  // Use deterministic ID - set will overwrite if exists (idempotent)
  const invoiceCollection = db
    .collection("tenants")
    .doc(tenantId)
    .collection("invoices");

  const invoiceRef = invoiceCollection.doc(docId);
  const now = FieldValue.serverTimestamp();

  await invoiceRef.set({
    id: docId,
    tenantId,
    monthCloseId,
    supplierNameRaw: invoiceData.supplierName || "Unknown",
    invoiceNumber: invoiceData.invoiceNumber,
    issueDate: invoiceData.issueDate || new Date().toISOString().split("T")[0],
    dueDate: invoiceData.dueDate,
    totalGross: invoiceData.totalGross,
    totalNet: invoiceData.totalNet,
    vatAmount: invoiceData.vatAmount,
    vatRate: invoiceData.vatRate,
    extractionConfidence: invoiceData.confidence,
    needsReview: invoiceData.confidence < 80,
    fingerprint,
    sourceFileId,
    sourceJobId: jobId,
    createdAt: now,
    updatedAt: now,
    createdBy: "system",
    updatedBy: "system",
    schemaVersion: 1,
  });

  functions.logger.info(`Created/updated invoice: ${docId}`);
}

interface ExtractedInvoice {
  invoiceNumber: string | null;
  supplierName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  totalGross: number | null;
  totalNet: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  confidence: number;
}

function extractInvoiceData(text: string): ExtractedInvoice {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Extract invoice number
  const invoiceNumber = extractPattern(lines, [
    /(?:invoice|factura|rechnung)\s*#?\s*:?\s*([A-Z0-9-]+)/i,
    /n[úu]mero\s*:?\s*([A-Z0-9-]+)/i,
  ]);

  // Extract supplier name (usually at top of invoice)
  const supplierName = lines.length > 0 ? lines[0] : null;

  // Extract dates
  const issueDate = extractDateFromText(lines, ["date", "fecha", "issued"]);
  const dueDate = extractDateFromText(lines, ["due", "vencimiento", "payment"]);

  // Extract amounts
  const amounts = extractAmounts(lines);

  // Calculate confidence
  let confidence = 0;
  if (invoiceNumber) confidence += 30;
  if (totalGrossFromAmounts(amounts)) confidence += 30;
  if (issueDate) confidence += 20;
  if (supplierName && supplierName.length > 2) confidence += 20;

  return {
    invoiceNumber,
    supplierName,
    issueDate,
    dueDate,
    totalGross: totalGrossFromAmounts(amounts),
    totalNet: amounts.net,
    vatAmount: amounts.vat,
    vatRate: amounts.vatRate,
    confidence,
  };
}

function extractPattern(lines: string[], patterns: RegExp[]): string | null {
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  return null;
}

function extractDateFromText(lines: string[], keywords: string[]): string | null {
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (keywords.some((k) => lowerLine.includes(k))) {
      const dateMatch = line.match(/(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/);
      if (dateMatch) {
        return parseDate(dateMatch[1]);
      }
    }
  }
  return null;
}

interface AmountInfo {
  gross: number | null;
  net: number | null;
  vat: number | null;
  vatRate: number | null;
}

function extractAmounts(lines: string[]): AmountInfo {
  const amounts: number[] = [];

  for (const line of lines) {
    const matches = line.match(/[\d.,]+(?:\s*(?:€|\$|EUR|USD))?/g);
    if (matches) {
      for (const m of matches) {
        const amount = parseAmount(m);
        if (!isNaN(amount) && amount > 0) {
          amounts.push(amount);
        }
      }
    }
  }

  // Sort and try to identify total (usually largest)
  amounts.sort((a, b) => b - a);

  const gross = amounts.length > 0 ? amounts[0] : null;

  // Try to find VAT amount
  let vat: number | null = null;
  let net: number | null = null;

  if (gross && amounts.length >= 2) {
    // Common VAT rates
    for (const rate of [21, 10, 4]) {
      const expectedVat = gross * rate / (100 + rate);
      const expectedNet = gross - expectedVat;

      // Check if we find matching amounts
      for (const amt of amounts) {
        if (Math.abs(amt - expectedVat) < 0.1) {
          vat = amt;
          net = expectedNet;
          break;
        }
      }
      if (vat) break;
    }
  }

  return {
    gross,
    net,
    vat,
    vatRate: vat && gross ? Math.round((vat / (gross - vat)) * 100) : null,
  };
}

function totalGrossFromAmounts(amounts: AmountInfo): number | null {
  return amounts.gross;
}

// =============================================================================
// MATCHING ENGINE
// =============================================================================

async function runMatching(
  db: FirebaseFirestore.Firestore,
  jobRef: FirebaseFirestore.DocumentReference,
  jobId: string,
  tenantId: string,
  monthCloseId: string
): Promise<void> {
  await updateJobProgress(jobRef, { stepKey: "jobs.steps.matching", pct: 60 });

  // ========================================
  // CLEANUP: Delete prior matches/exceptions from this job
  // CRITICAL: Only delete PROPOSED matches - preserve user-confirmed/rejected
  // This ensures re-run produces identical state without destroying user work
  // ========================================
  const priorMatchesSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .where("sourceJobId", "==", jobId)
    .where("status", "==", "PROPOSED") // ONLY delete unconfirmed matches
    .get();

  const priorExceptionsSnap = await db
    .collection("exceptions")
    .where("sourceJobId", "==", jobId)
    .where("status", "==", "OPEN") // ONLY delete unresolved exceptions
    .get();

  if (priorMatchesSnap.size > 0 || priorExceptionsSnap.size > 0) {
    const cleanupBatch = db.batch();
    priorMatchesSnap.forEach((doc) => cleanupBatch.delete(doc.ref));
    priorExceptionsSnap.forEach((doc) => cleanupBatch.delete(doc.ref));
    await cleanupBatch.commit();
    functions.logger.info(
      `Cleaned up ${priorMatchesSnap.size} PROPOSED matches, ${priorExceptionsSnap.size} OPEN exceptions (preserved user-confirmed)`
    );
  }

  // Load all bankTx for this month
  const bankTxSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("bankTx")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  // Load all invoices for this month
  const invoicesSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invoices")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  // Load existing matches
  const matchesSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  const matchedBankTxIds = new Set<string>();
  const matchedInvoiceIds = new Set<string>();

  matchesSnap.forEach((doc) => {
    const match = doc.data();
    if (match.bankTxIds) {
      match.bankTxIds.forEach((id: string) => matchedBankTxIds.add(id));
    }
    if (match.invoiceIds) {
      match.invoiceIds.forEach((id: string) => matchedInvoiceIds.add(id));
    }
  });

  const bankTxDocs = bankTxSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const invoiceDocs = invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  functions.logger.info(
    `Matching: ${bankTxDocs.length} bankTx, ${invoiceDocs.length} invoices`
  );

  const matchBatch = db.batch();
  const exceptionBatch = db.batch();
  let matchCount = 0;
  let exceptionCount = 0;

  // Match each unmatched bankTx to invoices
  for (const tx of bankTxDocs) {
    if (matchedBankTxIds.has(tx.id)) continue;

    const txData = tx as { id: string; amount: number; bookingDate: string; descriptionRaw: string };
    const candidates: Array<{ invoiceId: string; score: number }> = [];

    for (const inv of invoiceDocs) {
      if (matchedInvoiceIds.has(inv.id)) continue;

      const invData = inv as { id: string; totalGross: number; issueDate: string; supplierNameRaw: string };

      // Simple deterministic matching rules
      const score = calculateMatchScore(txData, invData);

      if (score >= 50) {
        candidates.push({ invoiceId: invData.id, score });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length >= 1) {
      const best = candidates[0];
      const isExact = best.score >= 90;

      // Create match with deterministic ID
      const matchIdContent = `${tenantId}:match:${tx.id}:${best.invoiceId}`;
      const matchDocId = generateDeterministicId(matchIdContent);
      const matchRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .doc(matchDocId);

      const now = FieldValue.serverTimestamp();

      matchBatch.set(matchRef, {
        id: matchDocId,
        tenantId,
        monthCloseId,
        bankTxIds: [tx.id],
        invoiceIds: [best.invoiceId],
        matchType: isExact ? "EXACT" : "FUZZY",
        score: best.score,
        status: "PROPOSED",
        explanationKey: isExact ? "matches.exact" : "matches.fuzzy",
        explanationParams: { score: best.score },
        sourceJobId: jobId,
        createdAt: now,
        updatedAt: now,
        createdBy: "system",
        updatedBy: "system",
        schemaVersion: 1,
      });

      matchedBankTxIds.add(tx.id);
      matchedInvoiceIds.add(best.invoiceId);
      matchCount++;
    } else {
      // Create exception for unmatched bankTx with deterministic ID
      const exceptionIdContent = `${tenantId}:exception:BANK_NO_INVOICE:${tx.id}`;
      const exceptionDocId = generateDeterministicId(exceptionIdContent);
      const exceptionRef = db.collection("exceptions").doc(exceptionDocId);
      const now = FieldValue.serverTimestamp();

      exceptionBatch.set(exceptionRef, {
        id: exceptionDocId,
        tenantId,
        monthCloseId,
        kind: "BANK_NO_INVOICE",
        refId: tx.id,
        refType: "bankTx",
        severity: Math.abs(txData.amount) > 1000 ? "HIGH" : "MEDIUM",
        status: "OPEN",
        message: `No matching invoice for transaction: ${txData.descriptionRaw?.substring(0, 50)}`,
        sourceJobId: jobId,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      exceptionCount++;
    }
  }

  // Create exceptions for unmatched invoices
  for (const inv of invoiceDocs) {
    if (matchedInvoiceIds.has(inv.id)) continue;

    const invData = inv as { id: string; totalGross: number; supplierNameRaw: string };

    // Create exception with deterministic ID
    const exceptionIdContent = `${tenantId}:exception:INVOICE_NO_BANK:${inv.id}`;
    const exceptionDocId = generateDeterministicId(exceptionIdContent);
    const exceptionRef = db.collection("exceptions").doc(exceptionDocId);
    const now = FieldValue.serverTimestamp();

    exceptionBatch.set(exceptionRef, {
      id: exceptionDocId,
      tenantId,
      monthCloseId,
      kind: "INVOICE_NO_BANK",
      refId: inv.id,
      refType: "invoice",
      severity: (invData.totalGross || 0) > 1000 ? "HIGH" : "MEDIUM",
      status: "OPEN",
      message: `No matching transaction for invoice: ${invData.supplierNameRaw?.substring(0, 50)}`,
      sourceJobId: jobId,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    });
    exceptionCount++;
  }

  await matchBatch.commit();
  await exceptionBatch.commit();

  functions.logger.info(
    `Matching complete: ${matchCount} matches, ${exceptionCount} exceptions`
  );
}

function calculateMatchScore(
  tx: { amount: number; bookingDate: string; descriptionRaw: string },
  inv: { totalGross: number; issueDate: string; supplierNameRaw: string }
): number {
  let score = 0;

  // Amount match (50 points max)
  const amountDiff = Math.abs(Math.abs(tx.amount) - Math.abs(inv.totalGross));
  const amountPercent = amountDiff / Math.abs(inv.totalGross);

  if (amountPercent < 0.001) {
    score += 50; // Exact match
  } else if (amountPercent < 0.01) {
    score += 40; // Within 1%
  } else if (amountPercent < 0.05) {
    score += 20; // Within 5%
  }

  // Date proximity (30 points max)
  const txDate = new Date(tx.bookingDate);
  const invDate = new Date(inv.issueDate);
  const daysDiff = Math.abs(
    (txDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysDiff <= 3) {
    score += 30;
  } else if (daysDiff <= 7) {
    score += 20;
  } else if (daysDiff <= 30) {
    score += 10;
  }

  // Description/supplier fuzzy match (20 points max)
  const descLower = (tx.descriptionRaw || "").toLowerCase();
  const supplierLower = (inv.supplierNameRaw || "").toLowerCase();

  if (descLower.includes(supplierLower) || supplierLower.includes(descLower)) {
    score += 20;
  } else {
    // Check for partial word matches
    const supplierWords = supplierLower.split(/\s+/).filter((w) => w.length > 3);
    const matchedWords = supplierWords.filter((w) => descLower.includes(w));
    if (matchedWords.length > 0) {
      score += Math.min(10, matchedWords.length * 5);
    }
  }

  return score;
}

// =============================================================================
// MONTH CLOSE RECOMPUTATION
// =============================================================================

async function recomputeMonthCloseSummary(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<void> {
  const monthCloseRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("monthCloses")
    .doc(monthCloseId);

  // Use transaction to ensure atomic read-modify-write
  // Queries are outside transaction (Firestore limitation) but update is atomic
  await db.runTransaction(async (tx) => {
    // Read monthClose inside transaction to get consistent state
    const monthCloseSnap = await tx.get(monthCloseRef);
    if (!monthCloseSnap.exists) {
      throw new Error(`MonthClose ${monthCloseId} not found`);
    }

    // Query all data for this month close (outside transaction - Firestore limitation)
    // These queries are done fresh to ensure we get latest data
    const [bankTxSnap, invoicesSnap, matchesSnap, exceptionsSnap] = await Promise.all([
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("bankTx")
        .where("monthCloseId", "==", monthCloseId)
        .get(),
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("invoices")
        .where("monthCloseId", "==", monthCloseId)
        .get(),
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .where("monthCloseId", "==", monthCloseId)
        .get(),
      db
        .collection("exceptions")
        .where("tenantId", "==", tenantId)
        .where("monthCloseId", "==", monthCloseId)
        .where("status", "==", "OPEN")
        .get(),
    ]);

    // Calculate totals
    let bankTotal = 0;
    bankTxSnap.forEach((doc) => {
      const data = doc.data();
      bankTotal += data.amount || 0;
    });

    let invoiceTotal = 0;
    invoicesSnap.forEach((doc) => {
      const data = doc.data();
      invoiceTotal += data.totalGross || 0;
    });

    const matchCount = matchesSnap.size;
    const openExceptionsCount = exceptionsSnap.size;
    const highExceptionsCount = exceptionsSnap.docs.filter(
      (d) => d.data().severity === "HIGH"
    ).length;

    const diff = bankTotal - invoiceTotal;

    // Update month close document atomically inside transaction
    tx.update(monthCloseRef, {
      bankTotal,
      invoiceTotal,
      diff,
      matchCount,
      openExceptionsCount,
      highExceptionsCount,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system",
    });

    functions.logger.info(
      `Month close summary updated: bank=${bankTotal}, invoice=${invoiceTotal}, diff=${diff}`
    );
  });
}
