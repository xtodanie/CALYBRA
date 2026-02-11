import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const TimestampSchema = z.instanceof(Timestamp);

export const MatchType = z.enum([
  "EXACT",
  "FUZZY",
  "GROUPED",
  "PARTIAL",
  "FEE",
  "MANUAL",
]);
export const MatchStatus = z.enum(["PROPOSED", "CONFIRMED", "REJECTED"]);

export const MatchSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  monthCloseId: z.string().min(1),
  bankTxIds: z.array(z.string().min(1)).min(1),
  invoiceIds: z.array(z.string().min(1)).min(1),
  matchType: MatchType,
  score: z.number().min(0).max(100),
  status: MatchStatus.default("PROPOSED"),
  explanationKey: z.string().min(1),
  explanationParams: z.record(z.union([z.string(), z.number()])),
  reason: z.string().max(2000).optional(),
  confirmedBy: z.string().min(1).optional(),
  confirmedAt: TimestampSchema.optional(),
  finalizedBy: z.string().min(1).optional(),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().default(1),
});

export type Match = z.infer<typeof MatchSchema>;
