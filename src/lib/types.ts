import type { Timestamp } from "firebase/firestore";

// Version all core document types
export const SCHEMA_VERSION = 1;

// =================================================================
// ENUMS - Single source of truth for status, kind, role literals.
// =================================================================

export enum UserRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  ACCOUNTANT = "ACCOUNTANT",
  VIEWER = "VIEWER",
}

export enum UserPlan {
  FREE = "free",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}

export enum UserStatus {
  ACTIVE = "active",
  DISABLED = "disabled",
}

export enum MonthCloseStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  FINALIZED = "FINALIZED",
}

export enum FileAssetKind {
  BANK_CSV = "BANK_CSV",
  INVOICE_PDF = "INVOICE_PDF",
  EXPORT = "EXPORT",
}

export enum FileAssetStatus {
  PENDING_UPLOAD = "PENDING_UPLOAD",
  UPLOADED = "UPLOADED",
  VERIFIED = "VERIFIED",
  REJECTED = "REJECTED",
  DELETED = "DELETED",
}

export enum ParseStatus {
  PENDING = "PENDING",
  PARSED = "PARSED",
  FAILED = "FAILED",
}

export enum JobType {
  PARSE_BANK_CSV = "PARSE_BANK_CSV",
  PARSE_INVOICE_PDF = "PARSE_INVOICE_PDF",
  NORMALIZE = "NORMALIZE",
  MATCH = "MATCH",
  SUMMARIZE = "SUMMARIZE",
  EXPORT = "EXPORT",
}

export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum MatchType {
  EXACT = "EXACT",
  FUZZY = "FUZZY",
  GROUPED = "GROUPED",
  PARTIAL = "PARTIAL",
  FEE = "FEE",
  MANUAL = "MANUAL",
}

export enum MatchStatus {
  PROPOSED = "PROPOSED",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

export enum ExceptionKind {
  BANK_NO_INVOICE = "BANK_NO_INVOICE",
  INVOICE_NO_BANK = "INVOICE_NO_BANK",
  AMOUNT_MISMATCH = "AMOUNT_MISMATCH",
  DUPLICATE = "DUPLICATE",
  AMBIGUOUS = "AMBIGUOUS",
  UNKNOWN_SUPPLIER = "UNKNOWN_SUPPLIER",
}

export enum ExceptionSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export enum ExceptionStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  IGNORED = "IGNORED",
}

export enum AuditAction {
    JOB_STATE_CHANGED = "JOB_STATE_CHANGED",
    MATCH_CONFIRMED = "MATCH_CONFIRMED",
    EXCEPTION_RESOLVED = "EXCEPTION_RESOLVED",
    MONTH_LOCKED = "MONTH_LOCKED",
    SIGNED_URL_GENERATED = "SIGNED_URL_GENERATED"
}

// =================================================================
// BASE & DOCUMENT INTERFACES
// =================================================================

interface BaseDocument {
  id: string;
  schemaVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface TenantOwnedDocument extends BaseDocument {
  tenantId: string;
}

export interface User extends BaseDocument {
  uid: string; // Overwrites BaseDocument `id` for clarity
  email: string | null;
  tenantId: string;
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  locale: 'en' | 'es';
  activeMonthCloseId?: string;
  metadata: {
    source: "signup" | "auto-recovery";
    recoveryCount?: number;
  };
}

export interface Tenant extends BaseDocument {
  name: string;
  ownerId: string;
  timezone: string;
  currency: 'EUR';
  settings?: {
    csvMappings?: unknown;
  };
}

export interface MonthClose extends TenantOwnedDocument {
  periodStart: Timestamp;
  periodEnd: Timestamp;
  status: MonthCloseStatus;
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  openExceptionsCount: number;
  highExceptionsCount: number;
  createdBy: string;
}

export interface FileAsset extends TenantOwnedDocument {
  monthCloseId: string;
  kind: FileAssetKind;
  filename: string;
  storagePath: string;
  status: FileAssetStatus;
  sha256?: string;
  parseStatus?: ParseStatus;
  parseError?: string | null;
}

export interface BankTx extends TenantOwnedDocument {
  monthCloseId: string;
  bookingDate: string; // YYYY-MM-DD
  amount: number;
  descriptionRaw: string;
  counterpartyRaw?: string | null;
  referenceRaw?: string | null;
  counterpartyId?: string | null;
  fingerprint: string; // sha256
  sourceFileId: string;
}

export interface Invoice extends TenantOwnedDocument {
  monthCloseId: string;
  supplierId?: string | null; // counterpartyId
  supplierNameRaw: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  totalGross: number;
  extractionConfidence: number; // 0-100
  needsReview: boolean;
  sourceFileId: string;
}

export interface Counterparty extends TenantOwnedDocument {
  displayName: string;
  aliases: string[];
  rules: {
    amountToleranceAbs: number;
    dateWindowDays: number;
    typicalFeeAbs?: number | null;
  };
}

export interface Match extends TenantOwnedDocument {
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
  finalizedBy?: string;
}

export interface Exception extends TenantOwnedDocument {
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
}

export interface Job extends TenantOwnedDocument {
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
    params?: Record<string, unknown>,
  } | null;
  refFileId: string;
}

export interface AuditEvent extends TenantOwnedDocument {
    actorUid: string;
    action: AuditAction;
    entityRef: { type: string, id: string };
  details: Record<string, unknown>;
}

export interface Evidence extends TenantOwnedDocument {
  fileId: string;
  storagePath?: string;
  page?: number;
  bbox?: number[];
  textAnchor?: string;
  snippetHash: string;
  extractor: string;
  confidenceRaw: number;
  confidenceValidated?: number;
}
