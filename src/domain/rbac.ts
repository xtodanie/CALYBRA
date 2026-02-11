import { UserRole as Role } from "@/lib/types";

export { Role };

export enum Permission {
  TENANT_READ = "TENANT_READ",
  USER_READ = "USER_READ",
  MONTH_CLOSE_READ = "MONTH_CLOSE_READ",
  MONTH_CLOSE_CREATE = "MONTH_CLOSE_CREATE",
  MONTH_CLOSE_UPDATE = "MONTH_CLOSE_UPDATE",
  MONTH_CLOSE_TRANSITION = "MONTH_CLOSE_TRANSITION",
  MONTH_CLOSE_FINALIZE = "MONTH_CLOSE_FINALIZE",
  FILE_ASSET_READ = "FILE_ASSET_READ",
  FILE_ASSET_CREATE = "FILE_ASSET_CREATE",
  INVOICE_READ = "INVOICE_READ",
  BANK_TX_READ = "BANK_TX_READ",
  MATCH_READ = "MATCH_READ",
  MATCH_CONFIRM = "MATCH_CONFIRM",
  MATCH_REJECT = "MATCH_REJECT",
  JOB_READ = "JOB_READ",
  EXCEPTION_READ = "EXCEPTION_READ",
}

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  [Role.VIEWER]: [
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.MONTH_CLOSE_READ,
    Permission.FILE_ASSET_READ,
    Permission.INVOICE_READ,
    Permission.BANK_TX_READ,
    Permission.MATCH_READ,
    Permission.JOB_READ,
    Permission.EXCEPTION_READ,
  ],
  [Role.ACCOUNTANT]: [
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.MONTH_CLOSE_READ,
    Permission.MONTH_CLOSE_CREATE,
    Permission.MONTH_CLOSE_UPDATE,
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.FILE_ASSET_READ,
    Permission.FILE_ASSET_CREATE,
    Permission.INVOICE_READ,
    Permission.BANK_TX_READ,
    Permission.MATCH_READ,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.JOB_READ,
    Permission.EXCEPTION_READ,
  ],
  [Role.MANAGER]: [
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.MONTH_CLOSE_READ,
    Permission.MONTH_CLOSE_CREATE,
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.FILE_ASSET_READ,
    Permission.FILE_ASSET_CREATE,
    Permission.INVOICE_READ,
    Permission.BANK_TX_READ,
    Permission.MATCH_READ,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.JOB_READ,
    Permission.EXCEPTION_READ,
  ],
  [Role.OWNER]: [
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.MONTH_CLOSE_READ,
    Permission.MONTH_CLOSE_CREATE,
    Permission.MONTH_CLOSE_UPDATE,
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MONTH_CLOSE_FINALIZE,
    Permission.FILE_ASSET_READ,
    Permission.FILE_ASSET_CREATE,
    Permission.INVOICE_READ,
    Permission.BANK_TX_READ,
    Permission.MATCH_READ,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.JOB_READ,
    Permission.EXCEPTION_READ,
  ],
};

export function hasPermission(
  user: { role: Role },
  permission: Permission
): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export function assertPermission(
  user: { role: Role },
  permission: Permission
): void {
  if (!hasPermission(user, permission)) {
    throw new Error(
      `Unauthorized: role=${user.role} permission=${permission}`
    );
  }
}

/**
 * Returns human-readable explanation for permission denial.
 * Used for logging/testing.
 */
export function explainPermissionDenied(
  user: { role: Role },
  permission: Permission
): string {
  const allowed = ROLE_PERMISSIONS[user.role];
  return `Role '${user.role}' does not have permission '${permission}'. Allowed: [${allowed.join(", ")}]`;
}
