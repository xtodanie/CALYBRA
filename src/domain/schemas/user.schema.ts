import { z } from "zod";
import { Timestamp } from "firebase/firestore";

const TimestampSchema = z.instanceof(Timestamp);

export const UserRole = z.enum(["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"]);
export const UserPlan = z.enum(["free", "pro", "enterprise"]);
export const UserStatus = z.enum(["active", "disabled"]);

export const UserSchema = z.object({
  uid: z.string().min(1),
  tenantId: z.string().min(1),
  role: UserRole,
  plan: UserPlan,
  status: UserStatus.default("active"),
  email: z.string().email().nullable(),
  displayName: z.string().max(200).optional(),
  locale: z.enum(["en", "es"]),
  activeMonthCloseId: z.string().optional(),
  metadata: z.object({
    source: z.enum(["signup", "auto-recovery"]),
    recoveryCount: z.number().optional(),
  }),
  // Server-authoritative fields.
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: z.string().min(1),
  updatedBy: z.string().min(1),
  schemaVersion: z.number().int().default(1),
});

export type User = z.infer<typeof UserSchema>;
