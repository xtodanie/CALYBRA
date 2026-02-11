import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimestampSchema = z.instanceof(Timestamp);

export const InvoiceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  monthCloseId: z.string().min(1),
  supplierNameRaw: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: DateString,
  totalGross: z.number().nonnegative(),
  extractionConfidence: z.number().min(0).max(100),
  needsReview: z.boolean(),
  sourceFileId: z.string().min(1),
  supplierId: z.string().min(1).optional(),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().default(1),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
