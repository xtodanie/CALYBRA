import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "./helpers/testEnv";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

const PROJECT_ID = "calybra-test-rules";

// Define user identities for testing
const myAuth = { uid: "user-owner", email: "owner@example.com", token: { admin: false } };
const myManagerAuth = { uid: "user-manager", email: "manager@example.com", token: { admin: false } };
const myViewerAuth = { uid: "user-viewer", email: "viewer@example.com", token: { admin: false } };
const otherTenantAuth = { uid: "user-other", email: "other@example.com", token: { admin: false } };
const serverAuth = { uid: "server-process", email: "server@example.com", token: { admin: true } }; // Simulates server

// Define resource IDs
const myTenantId = "tenant-my";
const otherTenantId = "tenant-other";
const myMonthCloseId = "month-my";
const myFileAssetId = "file-my";

type AuthInput = { uid: string; token?: { admin: boolean } };

// Helper to get a Firestore instance for a given user context
const db = (auth?: AuthInput) => {
  if (!testEnv) throw new Error("testEnv not initialized");
  if (!auth) return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(auth.uid, auth.token).firestore();
};

beforeAll(async () => {
  testEnv = await initTestEnv(PROJECT_ID);
});

afterAll(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seed initial data using an admin context to bypass security rules for setup
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Seed users with roles and tenant assignments
    await setDoc(doc(adminDb, "users", myAuth.uid), { tenantId: myTenantId, role: "OWNER" });
    await setDoc(doc(adminDb, "users", myManagerAuth.uid), { tenantId: myTenantId, role: "MANAGER" });
    await setDoc(doc(adminDb, "users", myViewerAuth.uid), { tenantId: myTenantId, role: "VIEWER" });
    await setDoc(doc(adminDb, "users", otherTenantAuth.uid), { tenantId: otherTenantId, role: "OWNER" });

    // Seed tenant-owned data for read/update tests
    await setDoc(doc(adminDb, "tenants", myTenantId, "monthCloses", myMonthCloseId), {
      tenantId: myTenantId,
      status: "DRAFT",
      periodStart: new Date(),
      periodEnd: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: myAuth.uid,
      updatedBy: myAuth.uid,
      schemaVersion: 1,
    });
    await setDoc(doc(adminDb, "tenants", otherTenantId, "monthCloses", "month-other"), {
      tenantId: otherTenantId,
      status: "DRAFT",
      periodStart: new Date(),
      periodEnd: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: otherTenantAuth.uid,
      updatedBy: otherTenantAuth.uid,
      schemaVersion: 1,
    });
    await setDoc(doc(adminDb, "tenants", myTenantId, "fileAssets", myFileAssetId), {
      tenantId: myTenantId,
      status: "PENDING_UPLOAD",
      monthCloseId: myMonthCloseId,
      kind: "BANK_CSV",
      filename: "file.csv",
      storagePath: "tenants/tenant-my/monthCloses/month-my/bank/file.csv",
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    });
  });
});

describe("Calybra Firestore Security Rules", () => {
  describe("Unauthenticated Access", () => {
    it("should PREVENT unauthenticated reads to monthCloses", async () => {
      const docRef = doc(db(), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertFails(getDoc(docRef));
    });

    it("should PREVENT unauthenticated writes to fileAssets", async () => {
      const docRef = doc(db(), "tenants", myTenantId, "fileAssets", "new-unauth-file");
      await assertFails(setDoc(docRef, { tenantId: myTenantId }));
    });
  });

  describe("Tenant Isolation", () => {
    it("should ALLOW a user to read documents in their own tenant", async () => {
      const docRef = doc(db(myAuth), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertSucceeds(getDoc(docRef));
    });

    it("should PREVENT a user from reading documents in another tenant", async () => {
      const docRef = doc(db(myAuth), "tenants", otherTenantId, "monthCloses", "month-other");
      await assertFails(getDoc(docRef));
    });

    it("should PREVENT a user from creating a document with a forged tenantId", async () => {
      const fullDocData = {
        tenantId: otherTenantId, // Attempting to write into another tenant
        monthCloseId: "any",
        kind: "INVOICE_PDF",
        filename: "test.pdf",
        storagePath: "/test.pdf",
        sha256: "hash",
        parseStatus: "PENDING",
        status: "PENDING_UPLOAD",
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 1,
      };
      const docRef = doc(db(myAuth), "tenants", myTenantId, "fileAssets", "cross-tenant-write");
      await assertFails(setDoc(docRef, fullDocData));
    });
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("should ALLOW an OWNER to update a draft monthClose", async () => {
      const docRef = doc(db(myAuth), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertSucceeds(updateDoc(docRef, { health: "MATCHED" }));
    });

    it("should PREVENT a VIEWER from updating a monthClose", async () => {
      const docRef = doc(db(myViewerAuth), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertFails(updateDoc(docRef, { health: "MATCHED" }));
    });
  });

  describe("Finalize Immutability", () => {
    it("should PREVENT an OWNER from updating a FINALIZED monthClose", async () => {
      // Must follow state machine: DRAFT -> IN_REVIEW -> FINALIZED
      const serverDocRef = doc(db(serverAuth), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertSucceeds(updateDoc(serverDocRef, { status: "IN_REVIEW" }));
      await assertSucceeds(updateDoc(serverDocRef, { status: "FINALIZED" }));

      const ownerDocRef = doc(db(myAuth), "tenants", myTenantId, "monthCloses", myMonthCloseId);
      await assertFails(updateDoc(ownerDocRef, { health: "NOT_MATCHED" }));
    });
  });

  describe("Client Create Constraints (fileAssets)", () => {
    const validFileAssetData = {
      tenantId: myTenantId,
      monthCloseId: myMonthCloseId,
      kind: "INVOICE_PDF",
      filename: "invoice.pdf",
      storagePath: "path/to/invoice.pdf",
      status: "PENDING_UPLOAD",
      parseStatus: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
      schemaVersion: 1,
    };

    it("should ALLOW creating a fileAsset with correct initial status and all allowed fields", async () => {
      const docRef = doc(db(myManagerAuth), "tenants", myTenantId, "fileAssets", "new-valid-file");
      await assertSucceeds(setDoc(docRef, validFileAssetData));
    });

    it("should PREVENT creating a fileAsset with a non-pending parseStatus", async () => {
      const docRef = doc(db(myManagerAuth), "tenants", myTenantId, "fileAssets", "new-invalid-status");
      const invalidData = { ...validFileAssetData, parseStatus: "PARSED" };
      await assertFails(setDoc(docRef, invalidData));
    });

    it("should PREVENT creating a fileAsset with extra, non-allowed fields", async () => {
      const docRef = doc(db(myManagerAuth), "tenants", myTenantId, "fileAssets", "new-extra-fields");
      const invalidData = { ...validFileAssetData, parseError: "an evil extra field" };
      await assertFails(setDoc(docRef, invalidData));
    });
  });

  describe("Server-Only Collections", () => {
    it("should PREVENT a client from writing to /invoices", async () => {
      const docRef = doc(db(myAuth), "tenants", myTenantId, "invoices", "client-invoice");
      const payload = {
        tenantId: myTenantId,
        monthCloseId: myMonthCloseId,
        supplierNameRaw: "Supplier",
        invoiceNumber: "INV-1",
        issueDate: "2026-01-01",
        totalGross: 100,
        extractionConfidence: 95,
        needsReview: false,
        sourceFileId: "fa_1",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: myAuth.uid,
        updatedBy: myAuth.uid,
        schemaVersion: 1,
      };
      await assertFails(setDoc(docRef, payload));
    });

    it("should ALLOW a server to write to /invoices", async () => {
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "invoices", "server-invoice");
      await assertSucceeds(setDoc(docRef, { tenantId: myTenantId, monthCloseId: myMonthCloseId }));
    });

    it("should PREVENT a client from writing to /bankTx", async () => {
      const docRef = doc(db(myAuth), "tenants", myTenantId, "bankTx", "client-tx");
      await assertFails(setDoc(docRef, { tenantId: myTenantId, amount: 100 }));
    });

    it("should PREVENT a client from writing to /matches", async () => {
      const docRef = doc(db(myAuth), "tenants", myTenantId, "matches", "client-match");
      const payload = {
        tenantId: myTenantId,
        monthCloseId: myMonthCloseId,
        bankTxIds: ["tx_1"],
        invoiceIds: ["inv_1"],
        matchType: "EXACT",
        score: 98,
        status: "PROPOSED",
        explanationKey: "amountAndName",
        explanationParams: { reason: "test" },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: myAuth.uid,
        updatedBy: myAuth.uid,
        schemaVersion: 1,
      };
      await assertFails(setDoc(docRef, payload));
    });

    it("should PREVENT a client from writing to /users", async () => {
      const docRef = doc(db(myAuth), "users", "another-user");
      await assertFails(setDoc(docRef, { tenantId: myTenantId, role: "OWNER" }));
    });

    it("should ALLOW a server to write to /users", async () => {
      const docRef = doc(db(serverAuth), "users", "new-server-user");
      await assertSucceeds(setDoc(docRef, { tenantId: myTenantId, role: "VIEWER" }));
    });
  });
});
