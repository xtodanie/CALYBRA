/**
 * Invariant: RBAC - Role-Based Access Control
 * 
 * Each role has specific permissions. This ensures:
 * - VIEWER: read-only access
 * - ACCOUNTANT: create monthClose/fileAsset, update monthClose (not status)
 * - MANAGER: create monthClose/fileAsset (no monthClose update)
 * - OWNER: full client access (except status transitions and server-only collections)
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "../helpers/testEnv";
import { shouldRunFirestoreEmulatorTests } from "../helpers/emulatorGuard";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;
let testEnv: RulesTestEnvironment;
const PROJECT_ID = "calybra-invariants-rbac";

const ownerAuth = { uid: "user-owner", token: { admin: false } };
const managerAuth = { uid: "user-manager", token: { admin: false } };
const accountantAuth = { uid: "user-accountant", token: { admin: false } };
const viewerAuth = { uid: "user-viewer", token: { admin: false } };
const tenantId = "tenant-test";

type AuthInput = { uid: string; token?: { admin: boolean } };

const db = (auth?: AuthInput) => {
  if (!testEnv) throw new Error("testEnv not initialized");
  if (!auth) return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(auth.uid, auth.token).firestore();
};

beforeAll(async () => {
  testEnv = await initTestEnv(PROJECT_ID);
});

afterAll(() => testEnv?.cleanup());

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, "users", ownerAuth.uid), { tenantId, role: "OWNER" });
    await setDoc(doc(adminDb, "users", managerAuth.uid), { tenantId, role: "MANAGER" });
    await setDoc(doc(adminDb, "users", accountantAuth.uid), { tenantId, role: "ACCOUNTANT" });
    await setDoc(doc(adminDb, "users", viewerAuth.uid), { tenantId, role: "VIEWER" });
    await setDoc(doc(adminDb, "tenants", tenantId), { name: "Test Tenant" });
    await setDoc(doc(adminDb, "tenants", tenantId, "monthCloses", "mc-test"), {
      tenantId,
      status: "DRAFT",
      periodStart: new Date(),
      periodEnd: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: ownerAuth.uid,
      updatedBy: ownerAuth.uid,
      schemaVersion: 1,
    });
  });
});

const validMonthCloseCreate = (creatorUid: string) => ({
  tenantId,
  periodStart: new Date(),
  periodEnd: new Date(),
  status: "DRAFT",
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: creatorUid,
  updatedBy: creatorUid,
  schemaVersion: 1,
});

const validFileAssetCreate = () => ({
  tenantId,
  monthCloseId: "mc-test",
  kind: "BANK_CSV",
  filename: "test.csv",
  storagePath: "/test.csv",
  status: "PENDING_UPLOAD",
  createdAt: new Date(),
  updatedAt: new Date(),
  schemaVersion: 1,
});

describeIfEmulator("INVARIANT: RBAC Permissions", () => {
  describe("VIEWER role", () => {
    it("can read tenant data", async () => {
      await assertSucceeds(getDoc(doc(db(viewerAuth), "tenants", tenantId)));
      await assertSucceeds(getDoc(doc(db(viewerAuth), "tenants", tenantId, "monthCloses", "mc-test")));
    });

    it("CANNOT create monthClose", async () => {
      const docRef = doc(db(viewerAuth), "tenants", tenantId, "monthCloses", "new-mc");
      await assertFails(setDoc(docRef, validMonthCloseCreate(viewerAuth.uid)));
    });

    it("CANNOT update monthClose", async () => {
      const docRef = doc(db(viewerAuth), "tenants", tenantId, "monthCloses", "mc-test");
      await assertFails(updateDoc(docRef, { notes: "viewer attempt" }));
    });

    it("CANNOT create fileAsset", async () => {
      const docRef = doc(db(viewerAuth), "tenants", tenantId, "fileAssets", "new-fa");
      await assertFails(setDoc(docRef, validFileAssetCreate()));
    });
  });

  describe("MANAGER role", () => {
    it("can read tenant data", async () => {
      await assertSucceeds(getDoc(doc(db(managerAuth), "tenants", tenantId)));
      await assertSucceeds(getDoc(doc(db(managerAuth), "tenants", tenantId, "monthCloses", "mc-test")));
    });

    it("can create monthClose", async () => {
      const docRef = doc(db(managerAuth), "tenants", tenantId, "monthCloses", "manager-mc");
      await assertSucceeds(setDoc(docRef, validMonthCloseCreate(managerAuth.uid)));
    });

    it("CANNOT update monthClose (only OWNER/ACCOUNTANT)", async () => {
      const docRef = doc(db(managerAuth), "tenants", tenantId, "monthCloses", "mc-test");
      await assertFails(updateDoc(docRef, { notes: "manager attempt" }));
    });

    it("can create fileAsset", async () => {
      const docRef = doc(db(managerAuth), "tenants", tenantId, "fileAssets", "manager-fa");
      await assertSucceeds(setDoc(docRef, validFileAssetCreate()));
    });
  });

  describe("ACCOUNTANT role", () => {
    it("can read tenant data", async () => {
      await assertSucceeds(getDoc(doc(db(accountantAuth), "tenants", tenantId)));
    });

    it("can create monthClose", async () => {
      const docRef = doc(db(accountantAuth), "tenants", tenantId, "monthCloses", "accountant-mc");
      await assertSucceeds(setDoc(docRef, validMonthCloseCreate(accountantAuth.uid)));
    });

    it("can update monthClose (excluding status)", async () => {
      const docRef = doc(db(accountantAuth), "tenants", tenantId, "monthCloses", "mc-test");
      await assertSucceeds(updateDoc(docRef, { notes: "accountant notes" }));
    });

    it("can create fileAsset", async () => {
      const docRef = doc(db(accountantAuth), "tenants", tenantId, "fileAssets", "accountant-fa");
      await assertSucceeds(setDoc(docRef, validFileAssetCreate()));
    });
  });

  describe("OWNER role", () => {
    it("can read tenant data", async () => {
      await assertSucceeds(getDoc(doc(db(ownerAuth), "tenants", tenantId)));
    });

    it("can create monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "monthCloses", "owner-mc");
      await assertSucceeds(setDoc(docRef, validMonthCloseCreate(ownerAuth.uid)));
    });

    it("can update monthClose (excluding status)", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "monthCloses", "mc-test");
      await assertSucceeds(updateDoc(docRef, { notes: "owner notes" }));
    });

    it("can create fileAsset", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "fileAssets", "owner-fa");
      await assertSucceeds(setDoc(docRef, validFileAssetCreate()));
    });
  });
});
