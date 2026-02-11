import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const TimestampSchema = z.instanceof(Timestamp);

export const MonthCloseStatus = z.enum(["DRAFT", "IN_REVIEW", "FINALIZED"]);

export const MonthCloseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  periodStart: TimestampSchema,
  periodEnd: TimestampSchema,
  status: MonthCloseStatus.default("DRAFT"),
  bankTotal: z.number().nonnegative(),
  invoiceTotal: z.number().nonnegative(),
  diff: z.number(),
  openExceptionsCount: z.number().int().nonnegative(),
  highExceptionsCount: z.number().int().nonnegative(),
  notes: z.string().max(2000).optional(),
  finalizedAt: TimestampSchema.optional(),
  finalizedBy: z.string().min(1).optional(),
  createdBy: z.string().min(1),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().default(1),
});

export type MonthClose = z.infer<typeof MonthCloseSchema>;
