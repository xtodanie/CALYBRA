import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const TimestampSchema = z.instanceof(Timestamp);

export const FileAssetKind = z.enum(["BANK_CSV", "INVOICE_PDF", "EXPORT"]);
export const FileAssetStatus = z.enum(["PENDING_UPLOAD"]);
export const FileAssetParseStatus = z.enum(["PENDING"]);

export const FileAssetSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  monthCloseId: z.string().min(1),
  kind: FileAssetKind,
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  status: FileAssetStatus.default("PENDING_UPLOAD"),
  parseStatus: FileAssetParseStatus.optional(),
  parseError: z.string().nullable().optional(),
  sha256: z.string().min(1).optional(),
  parsedAt: TimestampSchema.optional(),
  parsedBy: z.string().min(1).optional(),
  notes: z.string().max(2000).optional(),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  schemaVersion: z.number().int().default(1),
});

export type FileAsset = z.infer<typeof FileAssetSchema>;
