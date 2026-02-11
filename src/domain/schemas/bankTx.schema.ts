import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimestampSchema = z.instanceof(Timestamp);

export const BankTxSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  monthCloseId: z.string().min(1),
  bookingDate: DateString,
  amount: z.number(),
  descriptionRaw: z.string().min(1),
  fingerprint: z.string().min(1),
  sourceFileId: z.string().min(1),
  counterpartyRaw: z.string().min(1).optional(),
  referenceRaw: z.string().min(1).optional(),
  counterpartyId: z.string().min(1).optional(),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().default(1),
});

export type BankTx = z.infer<typeof BankTxSchema>;
