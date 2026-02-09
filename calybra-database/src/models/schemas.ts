/**
 * @fileoverview Zod schemas for runtime validation of Firestore documents.
 * These schemas enforce the canonical data contracts defined in `src/lib/types.ts`.
 */

import { z } from "zod";
import {
  SCHEMA_VERSION,
  UserRole,
  UserPlan,
  UserStatus,
  MonthCloseStatus,
  FileAssetKind,
  ParseStatus,
  JobType,
  JobStatus,
  MatchType,
  MatchStatus,
  ExceptionKind,
  ExceptionSeverity,
  ExceptionStatus,
  AuditAction,
} from "@/lib/types";

// =================================================================
// BASE SCHEMAS
// =================================================================

// Fields managed by the server on every document. Not part of client payloads for create.
const ServerManagedFields = {
  id: z.string(),
  schemaVersion: z.literal(SCHEMA_VERSION),
  tenantId: z.string().min(1),
  createdAt: z.any(), // On write, this will be a server timestamp
  updatedAt: z.any(), // On write, this will be a server timestamp
};

// =================================================================
// COLLECTION SCHEMAS
// =================================================================

export const UserSchema = z.object({
  uid: z.string(),
  email: z.string().email().nullable(),
  role: z.nativeEnum(UserRole),
  plan: z.nativeEnum(UserPlan),
  status: z.nativeEnum(UserStatus),
  locale: z.enum(["en", "es"]),
  activeMonthCloseId: z.string().optional(),
  metadata: z.object({
    source: z.enum(["signup", "auto-recovery"]),
    recoveryCount: z.number().optional(),
  }),
  ...ServerManagedFields,
}).strict();

export const MonthCloseCreateSchema = z.object({
  periodStart: z.date(),
  periodEnd: z.date(),
}).strict();

export const MonthCloseUpdateSchema = z.object({
  status: z.nativeEnum(MonthCloseStatus).optional(),
  bankTotal: z.number().optional(),
  invoiceTotal: z.number().optional(),
  diff: z.number().optional(),
  openExceptionsCount: z.number().optional(),
  highExceptionsCount: z.number().optional(),
}).strict();


export const FileAssetClientCreateSchema = z.object({
  monthCloseId: z.string().min(1),
  kind: z.nativeEnum(FileAssetKind).refine(k => k !== FileAssetKind.EXPORT, { message: "Client cannot create EXPORT assets" }),
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  sha256: z.string().min(1),
}).strict();

export const FileAssetServerUpdateSchema = z.object({
    parseStatus: z.nativeEnum(ParseStatus).optional(),
    parseError: z.string().nullable().optional(),
}).strict();


export const JobServerCreateSchema = z.object({
    monthCloseId: z.string().min(1),
    type: z.nativeEnum(JobType),
    refFileId: z.string().min(1),
}).strict();

export const JobServerUpdateSchema = z.object({
    status: z.nativeEnum(JobStatus).optional(),
    progress: z.object({
        stepKey: z.string(),
        pct: z.number().min(0).max(100),
    }).optional(),
    error: z.object({
        code: z.string(),
        messageKey: z.string(),
        params: z.record(z.any()).optional(),
    }).nullable().optional(),
}).strict();


export const InvoiceServerCreateSchema = z.object({
  monthCloseId: z.string().min(1),
  supplierNameRaw: z.string(),
  invoiceNumber: z.string(),
  issueDate: z.string(), // YYYY-MM-DD
  totalGross: z.number(),
  extractionConfidence: z.number(),
  needsReview: z.boolean(),
  sourceFileId: z.string(),
  supplierId: z.string().nullable().optional(),
}).strict();

export const BankTxServerCreateSchema = z.object({
  monthCloseId: z.string().min(1),
  bookingDate: z.string(), // YYYY-MM-DD
  amount: z.number(),
  descriptionRaw: z.string(),
  fingerprint: z.string(),
  sourceFileId: z.string(),
  counterpartyRaw: z.string().nullable().optional(),
  referenceRaw: z.string().nullable().optional(),
  counterpartyId: z.string().nullable().optional(),
}).strict();

export const MatchServerCreateSchema = z.object({
  monthCloseId: z.string().min(1),
  bankTxIds: z.array(z.string()).min(1),
  invoiceIds: z.array(z.string()).min(1),
  matchType: z.nativeEnum(MatchType),
  score: z.number().min(0).max(100),
  status: z.literal(MatchStatus.PROPOSED),
  explanationKey: z.string(),
  explanationParams: z.record(z.any()),
}).strict();

export const ExceptionServerCreateSchema = z.object({
  monthCloseId: z.string().min(1),
  kind: z.nativeEnum(ExceptionKind),
  severity: z.nativeEnum(ExceptionSeverity),
  status: z.literal(ExceptionStatus.OPEN),
  suggestedActionKey: z.string(),
  bankTxId: z.string().optional().nullable(),
  invoiceId: z.string().optional().nullable(),
}).strict();

export const AuditEventServerCreateSchema = z.object({
  actorUid: z.string(),
  action: z.nativeEnum(AuditAction),
  entityRef: z.object({
    type: z.string(),
    id: z.string(),
  }),
  details: z.record(z.any()),
}).strict();
