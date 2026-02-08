import type { Timestamp } from "firebase/firestore";

// Version all core document types
const SCHEMA_VERSION = 1;

export type UserRole = "OWNER" | "MANAGER" | "ACCOUNTANT" | "VIEWER";
export type UserPlan = "free" | "pro" | "enterprise";
export type UserStatus = "active" | "disabled";

export type User = {
  uid: string;
  email: string | null;
  tenantId: string;
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  locale: 'en' | 'es';
  activeMonthCloseId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
  metadata: {
    source: "signup" | "auto-recovery";
    recoveryCount?: number;
  };
};

export type Tenant = {
  id: string;
  name: string;
  ownerId: string;
  timezone: string;
  currency: 'EUR';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
  settings?: {
    csvMappings?: any;
  };
};

export type MonthCloseStatus = "DRAFT" | "PROCESSING" | "READY" | "LOCKED";
export type MonthCloseHealth = "MATCHED" | "MATCHED_WITH_NOTES" | "NOT_MATCHED";

export type MonthClose = {
  id: string;
  tenantId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  status: MonthCloseStatus;
  health: MonthCloseHealth;
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  openExceptionsCount: number;
  highExceptionsCount: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};

export type FileAssetKind = "BANK_CSV" | "INVOICE_PDF" | "EXPORT";
export type ParseStatus = "PENDING" | "PARSED" | "FAILED";

export type FileAsset = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  kind: FileAssetKind;
  filename: string;
  storagePath: string;
  sha256: string;
  parseStatus: ParseStatus;
  parseError?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};

export type BankTx = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  bookingDate: string; // YYYY-MM-DD
  amount: number;
  descriptionRaw: string;
  counterpartyRaw?: string | null;
  referenceRaw?: string | null;
  counterpartyId?: string | null;
  fingerprint: string; // sha256
  sourceFileId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};

export type Invoice = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  supplierId?: string | null; // counterpartyId
  supplierNameRaw: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  totalGross: number;
  extractionConfidence: number; // 0-100
  needsReview: boolean;
  sourceFileId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};

export type Counterparty = {
  id: string;
  tenantId: string;
  displayName: string;
  aliases: string[];
  rules: {
    amountToleranceAbs: number;
    dateWindowDays: number;
    typicalFeeAbs?: number | null;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};

export type MatchType = "EXACT" | "FUZZY" | "GROUPED" | "PARTIAL" | "FEE" | "MANUAL";
export type MatchStatus = "PROPOSED" | "CONFIRMED" | "REJECTED";

export type Match = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  bankTxIds: string[];
  invoiceIds: string[];
  matchType: MatchType;
  score: number; // 0-100
  status: MatchStatus;
  explanationKey: string;
  explanationParams: Record<string, string | number>;
  confirmedBy?: string | null;
  confirmedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
  finalizedBy?: string; // Server-only field
};

export type ExceptionKind = "BANK_NO_INVOICE" | "INVOICE_NO_BANK" | "AMOUNT_MISMATCH" | "DUPLICATE" | "AMBIGUOUS" | "UNKNOWN_SUPPLIER";
export type ExceptionSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ExceptionStatus = "OPEN" | "RESOLVED" | "IGNORED";

export type Exception = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  kind: ExceptionKind;
  severity: ExceptionSeverity;
  bankTxId?: string | null;
  invoiceId?: string | null;
  status: ExceptionStatus;
  suggestedActionKey: string;
  suggestedActionParams: Record<string, string | number>;
  resolvedBy?: string | null;
  resolvedAt?: Timestamp | null;
  ignoreReason?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};


export type JobType =
  | "PARSE_BANK_CSV"
  | "PARSE_INVOICE_PDF"
  | "NORMALIZE"
  | "MATCH"
  | "SUMMARIZE"
  | "EXPORT";

export type JobStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export type Job = {
  id: string;
  tenantId: string;
  monthCloseId: string;
  type: JobType;
  status: JobStatus;
  progress: {
    stepKey: string,
    pct: number,
  },
  error: {
    code: string,
    messageKey: string,
    params?: Record<string, any>,
  } | null;
  refFileId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  schemaVersion: number;
};


// New AuditEvent contract as per Phase 2 requirements
export type AuditEvent = {
  id: string;
  type: string;
  actor: string; // user id
  tenantId: string;
  monthCloseId?: string;
  entityRefs: { type: string; id: string }[];
  before: Record<string, any>;
  after: Record<string, any>;
  evidenceRefs?: { type: string; id: string }[];
  schemaVersion: number;
  createdAt: Timestamp;
};

// New Evidence contract as per Phase 2 requirements
export type Evidence = {
  id: string;
  fileId: string;
  storagePath?: string;
  page?: number;
  bbox?: number[];
  textAnchor?: string;
  snippetHash: string;
  extractor: string;
  confidenceRaw: number;
  confidenceValidated?: number;
  schemaVersion: number;
};
