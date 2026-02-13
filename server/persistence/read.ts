/**
 * Persistence - Read Operations
 * IO layer. All Firestore reads live here.
 *
 * INVARIANT: This module is the ONLY place that reads from Firestore
 * INVARIANT: Returns typed domain objects, never raw Firestore data
 */

import { Firestore } from "firebase-admin/firestore";

// ============================================================================
// STORED TYPES (Firestore document shapes)
// ============================================================================

export interface StoredMonthClose {
  id: string;
  tenantId: string;
  periodStart: FirebaseFirestore.Timestamp;
  periodEnd: FirebaseFirestore.Timestamp;
  status: string;
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  openExceptionsCount: number;
  highExceptionsCount: number;
  notes?: string;
  finalizedAt?: FirebaseFirestore.Timestamp;
  finalizedBy?: string;
  createdBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  updatedBy: string;
  schemaVersion: number;
}

export interface StoredFileAsset {
  id: string;
  tenantId: string;
  monthCloseId: string;
  kind: string;
  filename: string;
  storagePath: string;
  status: string;
  parseStatus?: string;
  parseError?: string | null;
  sha256?: string;
  parsedAt?: FirebaseFirestore.Timestamp;
  parsedBy?: string;
  notes?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  schemaVersion: number;
}

export interface StoredBankTx {
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
  counterpartyId?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
}

export interface StoredInvoice {
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
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
}

export interface StoredMatch {
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
  reason?: string;
  confirmedBy?: string;
  confirmedAt?: FirebaseFirestore.Timestamp;
  finalizedBy?: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
}

export interface StoredUser {
  uid: string;
  tenantId: string;
  role: string;
  plan: string;
  status: string;
  email: string | null;
  locale: string;
  displayName?: string;
  activeMonthCloseId?: string;
  metadata: { source: string; recoveryCount?: number };
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  createdBy: string;
  updatedBy: string;
  schemaVersion: number;
}

export interface StoredEvent {
  id: string;
  tenantId: string;
  type: string;
  occurredAt: string;
  recordedAt: string;
  monthKey: string;
  deterministicId: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
}

export interface StoredPeriod {
  id: string; // monthKey
  tenantId: string;
  status: "OPEN" | "FINALIZED";
  finalizedAt?: FirebaseFirestore.Timestamp;
  closeConfig?: { asOfDays: number[] };
  periodLockHash?: string;
  createdAt?: FirebaseFirestore.Timestamp;
  updatedAt?: FirebaseFirestore.Timestamp;
  createdBy?: string;
  updatedBy?: string;
  schemaVersion: number;
}

export interface StoredJob {
  id: string;
  tenantId: string;
  monthKey: string;
  action: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  periodLockHash: string;
  startedAt: FirebaseFirestore.Timestamp;
  completedAt?: FirebaseFirestore.Timestamp;
  outputsRefs?: Record<string, string>;
  errorCode?: string;
  errorMessage?: string;
  schemaVersion: number;
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

/**
 * Reads a MonthClose by ID
 */
export async function readMonthClose(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredMonthClose | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("monthCloses")
    .doc(monthCloseId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredMonthClose;
}

/**
 * Reads all MonthCloses for a tenant
 */
export async function readMonthCloses(
  db: Firestore,
  tenantId: string
): Promise<StoredMonthClose[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("monthCloses")
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredMonthClose);
}

/**
 * Reads a FileAsset by ID
 */
export async function readFileAsset(
  db: Firestore,
  tenantId: string,
  fileAssetId: string
): Promise<StoredFileAsset | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("fileAssets")
    .doc(fileAssetId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredFileAsset;
}

/**
 * Reads all FileAssets for a MonthClose
 */
export async function readFileAssetsByMonthClose(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredFileAsset[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("fileAssets")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredFileAsset);
}

/**
 * Reads a BankTx by ID
 */
export async function readBankTx(
  db: Firestore,
  tenantId: string,
  bankTxId: string
): Promise<StoredBankTx | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("bankTx")
    .doc(bankTxId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredBankTx;
}

/**
 * Reads all BankTx for a MonthClose
 */
export async function readBankTxByMonthClose(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredBankTx[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("bankTx")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredBankTx);
}

/**
 * Reads an Invoice by ID
 */
export async function readInvoice(
  db: Firestore,
  tenantId: string,
  invoiceId: string
): Promise<StoredInvoice | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invoices")
    .doc(invoiceId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredInvoice;
}

/**
 * Reads all Invoices for a MonthClose
 */
export async function readInvoicesByMonthClose(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredInvoice[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("invoices")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredInvoice);
}

/**
 * Reads a Match by ID
 */
export async function readMatch(
  db: Firestore,
  tenantId: string,
  matchId: string
): Promise<StoredMatch | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .doc(matchId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredMatch;
}

/**
 * Reads all Matches for a MonthClose
 */
export async function readMatchesByMonthClose(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredMatch[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .where("monthCloseId", "==", monthCloseId)
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredMatch);
}

/**
 * Reads events by monthKey
 */
export async function readEventsByMonth(
  db: Firestore,
  tenantId: string,
  monthKey: string
): Promise<StoredEvent[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("events")
    .where("monthKey", "==", monthKey)
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredEvent);
}

/**
 * Reads a period by monthKey
 */
export async function readPeriod(
  db: Firestore,
  tenantId: string,
  monthKey: string
): Promise<StoredPeriod | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("periods")
    .doc(monthKey)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredPeriod;
}

/**
 * Reads a job record by ID
 */
export async function readJob(
  db: Firestore,
  jobId: string
): Promise<StoredJob | null> {
  const doc = await db.collection("jobs").doc(jobId).get();
  if (!doc.exists) return null;
  return doc.data() as StoredJob;
}

/**
 * Reads an export artifact
 */
export async function readExportArtifact(
  db: Firestore,
  tenantId: string,
  monthKey: string,
  artifactId: "ledgerCsv" | "summaryPdf"
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("exports")
    .doc(monthKey)
    .collection("artifacts")
    .doc(artifactId)
    .get();

  if (!doc.exists) return null;
  return doc.data() as Record<string, unknown>;
}

/**
 * Reads persisted brain artifacts for a month
 */
export async function readBrainArtifactsByMonth(
  db: Firestore,
  tenantId: string,
  monthKey: string
): Promise<Record<string, unknown>[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc("brainArtifacts")
    .collection("items")
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((item) => item["monthKey"] === monthKey)
    .sort((left, right) => {
      const leftAt = typeof left["generatedAt"] === "string" ? left["generatedAt"] : "";
      const rightAt = typeof right["generatedAt"] === "string" ? right["generatedAt"] : "";
      return leftAt.localeCompare(rightAt);
    });
}

/**
 * Reads confirmed Matches for a MonthClose (for exclusion checks)
 */
export async function readConfirmedMatches(
  db: Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<StoredMatch[]> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("matches")
    .where("monthCloseId", "==", monthCloseId)
    .where("status", "==", "CONFIRMED")
    .get();

  return snapshot.docs.map((doc) => doc.data() as StoredMatch);
}

/**
 * Reads a User by UID
 */
export async function readUser(
  db: Firestore,
  uid: string
): Promise<StoredUser | null> {
  const doc = await db.collection("users").doc(uid).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as StoredUser;
}

/**
 * Checks if a BankTx with the same fingerprint already exists
 */
export async function findBankTxByFingerprint(
  db: Firestore,
  tenantId: string,
  monthCloseId: string,
  fingerprint: string
): Promise<StoredBankTx | null> {
  const snapshot = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("bankTx")
    .where("monthCloseId", "==", monthCloseId)
    .where("fingerprint", "==", fingerprint)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as StoredBankTx;
}

/**
 * Lists all tenant IDs
 */
export async function readTenantIds(db: Firestore): Promise<string[]> {
  const snapshot = await db.collection("tenants").get();
  return snapshot.docs.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
}

/**
 * Reads a readmodel snapshot at: tenants/{tenantId}/readmodels/{modelName}/{docId}/snapshot
 */
export async function readReadmodelSnapshot(
  db: Firestore,
  tenantId: string,
  modelName: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc(modelName)
    .collection(docId)
    .doc("snapshot")
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Record<string, unknown>;
}

/**
 * Reads a readmodel item at: tenants/{tenantId}/readmodels/{modelName}/items/{itemId}
 */
export async function readReadmodelItem(
  db: Firestore,
  tenantId: string,
  modelName: string,
  itemId: string
): Promise<Record<string, unknown> | null> {
  const doc = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("readmodels")
    .doc(modelName)
    .collection("items")
    .doc(itemId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as Record<string, unknown>;
}
