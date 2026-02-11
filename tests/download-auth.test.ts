import { assertAllowedDownload, buildFileAssetDocPath, DownloadAuthError } from "../calybra-database/src/lib/download";

type UserData = { tenantId: string; role: string };

type FileAssetData = { tenantId?: string; storagePath?: string };

function getErrorCode(fn: () => void): string {
  try {
    fn();
  } catch (err) {
    if (err instanceof DownloadAuthError) return err.code;
    return "unknown";
  }
  return "none";
}

describe("download helpers", () => {
  it("buildFileAssetDocPath uses tenant-scoped path", () => {
    expect(buildFileAssetDocPath("tenant-1", "file-1")).toBe(
      "tenants/tenant-1/fileAssets/file-1"
    );
  });

  it("denies download when file asset is missing", () => {
    const user: UserData = { tenantId: "tenant-1", role: "OWNER" };
    const code = getErrorCode(() => assertAllowedDownload(user, null));
    expect(code).toBe("not-found");
  });

  it("denies download for disallowed roles", () => {
    const user: UserData = { tenantId: "tenant-1", role: "SUSPENDED" };
    const file: FileAssetData = {
      tenantId: "tenant-1",
      storagePath: "tenants/tenant-1/monthCloses/mc-1/bank/file-1.csv",
    };
    const code = getErrorCode(() => assertAllowedDownload(user, file));
    expect(code).toBe("permission-denied");
  });

  it("allows download for accountant role", () => {
    const user: UserData = { tenantId: "tenant-1", role: "ACCOUNTANT" };
    const file: FileAssetData = {
      tenantId: "tenant-1",
      storagePath: "tenants/tenant-1/monthCloses/mc-1/bank/file-1.csv",
    };
    const code = getErrorCode(() => assertAllowedDownload(user, file));
    expect(code).toBe("none");
  });

  it("allows download for viewer role", () => {
    const user: UserData = { tenantId: "tenant-1", role: "VIEWER" };
    const file: FileAssetData = {
      tenantId: "tenant-1",
      storagePath: "tenants/tenant-1/monthCloses/mc-1/bank/file-1.csv",
    };
    const code = getErrorCode(() => assertAllowedDownload(user, file));
    expect(code).toBe("none");
  });

  it("denies download for tenant mismatch", () => {
    const user: UserData = { tenantId: "tenant-1", role: "OWNER" };
    const file: FileAssetData = {
      tenantId: "tenant-2",
      storagePath: "tenants/tenant-2/monthCloses/mc-1/bank/file-1.csv",
    };
    const code = getErrorCode(() => assertAllowedDownload(user, file));
    expect(code).toBe("permission-denied");
  });

  it("denies download when storage path is outside tenant", () => {
    const user: UserData = { tenantId: "tenant-1", role: "OWNER" };
    const file: FileAssetData = {
      tenantId: "tenant-1",
      storagePath: "tenants/tenant-2/monthCloses/mc-1/bank/file-1.csv",
    };
    const code = getErrorCode(() => assertAllowedDownload(user, file));
    expect(code).toBe("permission-denied");
  });
});
