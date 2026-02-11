type UserData = {
  tenantId: string;
  role: string;
};

type FileAssetData = {
  tenantId?: string;
  storagePath?: string;
};

export type DownloadAuthErrorCode = "not-found" | "permission-denied";

export class DownloadAuthError extends Error {
  code: DownloadAuthErrorCode;

  constructor(code: DownloadAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DownloadAuthError";
  }
}

const ALLOWED_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"];

export function buildFileAssetDocPath(tenantId: string, fileAssetId: string): string {
  return `tenants/${tenantId}/fileAssets/${fileAssetId}`;
}

export function assertAllowedDownload(
  userData: UserData,
  fileAssetData: FileAssetData | null
): void {
  if (!fileAssetData) {
    throw new DownloadAuthError("not-found", "File not found.");
  }

  if (!ALLOWED_ROLES.includes(userData.role)) {
    throw new DownloadAuthError(
      "permission-denied",
      "You do not have permission to download this file."
    );
  }

  if (fileAssetData.tenantId && fileAssetData.tenantId !== userData.tenantId) {
    throw new DownloadAuthError(
      "permission-denied",
      "You do not have permission to access this file."
    );
  }

  if (!fileAssetData.storagePath) {
    throw new DownloadAuthError("not-found", "File not found.");
  }

  const expectedPrefix = `tenants/${userData.tenantId}/`;
  if (!fileAssetData.storagePath.startsWith(expectedPrefix)) {
    throw new DownloadAuthError(
      "permission-denied",
      "You do not have permission to access this file."
    );
  }
}
