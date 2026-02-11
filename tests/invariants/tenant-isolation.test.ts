/**
 * Invariant: Tenant Isolation
 * 
 * A user can ONLY access data belonging to their assigned tenant.
 * Cross-tenant reads or writes must ALWAYS fail.
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "../helpers/testEnv";
import { doc, getDoc, setDoc, collection, getDocs, query } from "firebase/firestore";

let testEnv: RulesTestEnvironment;
const PROJECT_ID = "calybra-invariants-tenant";

// Tenant A user
const tenantAUser = { uid: "user-tenant-a", token: { admin: false } };
// Tenant B user
const tenantBUser = { uid: "user-tenant-b", token: { admin: false } };
const serverAuth = { uid: "server", token: { admin: true } };

const tenantAId = "tenant-a";
const tenantBId = "tenant-b";

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
    // User A belongs to tenant A
    await setDoc(doc(adminDb, "users", tenantAUser.uid), { tenantId: tenantAId, role: "OWNER" });
    // User B belongs to tenant B
    await setDoc(doc(adminDb, "users", tenantBUser.uid), { tenantId: tenantBId, role: "OWNER" });

    // Seed data for both tenants
    await setDoc(doc(adminDb, "tenants", tenantAId), { name: "Tenant A" });
    await setDoc(doc(adminDb, "tenants", tenantBId), { name: "Tenant B" });
    await setDoc(doc(adminDb, "tenants", tenantAId, "monthCloses", "mc-a"), {
      tenantId: tenantAId, status: "DRAFT", periodStart: new Date(), periodEnd: new Date(),
      createdAt: new Date(), updatedAt: new Date(), createdBy: tenantAUser.uid, updatedBy: tenantAUser.uid, schemaVersion: 1,
    });
    await setDoc(doc(adminDb, "tenants", tenantBId, "monthCloses", "mc-b"), {
      tenantId: tenantBId, status: "DRAFT", periodStart: new Date(), periodEnd: new Date(),
      createdAt: new Date(), updatedAt: new Date(), createdBy: tenantBUser.uid, updatedBy: tenantBUser.uid, schemaVersion: 1,
    });
    await setDoc(doc(adminDb, "tenants", tenantAId, "invoices", "inv-a"), { tenantId: tenantAId });
    await setDoc(doc(adminDb, "tenants", tenantBId, "invoices", "inv-b"), { tenantId: tenantBId });
  });
});

describe("INVARIANT: Tenant Isolation", () => {
  describe("Read Isolation", () => {
    it("user A can read tenant A data", async () => {
      await assertSucceeds(getDoc(doc(db(tenantAUser), "tenants", tenantAId)));
      await assertSucceeds(getDoc(doc(db(tenantAUser), "tenants", tenantAId, "monthCloses", "mc-a")));
      await assertSucceeds(getDoc(doc(db(tenantAUser), "tenants", tenantAId, "invoices", "inv-a")));
    });

    it("user A CANNOT read tenant B data", async () => {
      await assertFails(getDoc(doc(db(tenantAUser), "tenants", tenantBId)));
      await assertFails(getDoc(doc(db(tenantAUser), "tenants", tenantBId, "monthCloses", "mc-b")));
      await assertFails(getDoc(doc(db(tenantAUser), "tenants", tenantBId, "invoices", "inv-b")));
    });

    it("user B CANNOT read tenant A data", async () => {
      await assertFails(getDoc(doc(db(tenantBUser), "tenants", tenantAId)));
      await assertFails(getDoc(doc(db(tenantBUser), "tenants", tenantAId, "monthCloses", "mc-a")));
    });
  });

  describe("Write Isolation", () => {
    it("user A CANNOT create documents with forged tenantId pointing to tenant B", async () => {
      const forgedData = {
        tenantId: tenantBId, // FORGED - tries to claim tenant B
        monthCloseId: "mc-a",
        kind: "INVOICE_PDF",
        filename: "forged.pdf",
        storagePath: "/forged.pdf",
        status: "PENDING_UPLOAD",
        createdAt: new Date(),
        updatedAt: new Date(),
        schemaVersion: 1,
      };
      // Attempt to write to tenant A path with forged tenantB ID
      const docRef = doc(db(tenantAUser), "tenants", tenantAId, "fileAssets", "forged-file");
      await assertFails(setDoc(docRef, forgedData));
    });

    it("user A CANNOT write to tenant B path", async () => {
      const data = {
        tenantId: tenantBId,
        periodStart: new Date(),
        periodEnd: new Date(),
        status: "DRAFT",
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: tenantAUser.uid,
        updatedBy: tenantAUser.uid,
        schemaVersion: 1,
      };
      const docRef = doc(db(tenantAUser), "tenants", tenantBId, "monthCloses", "cross-tenant-write");
      await assertFails(setDoc(docRef, data));
    });
  });

  describe("Jobs/Exceptions Isolation", () => {
    it("user A can read jobs with tenantId matching their tenant", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "jobs", "job-a"), { tenantId: tenantAId, status: "RUNNING" });
        await setDoc(doc(ctx.firestore(), "jobs", "job-b"), { tenantId: tenantBId, status: "RUNNING" });
      });
      await assertSucceeds(getDoc(doc(db(tenantAUser), "jobs", "job-a")));
      await assertFails(getDoc(doc(db(tenantAUser), "jobs", "job-b")));
    });

    it("user A can read exceptions with tenantId matching their tenant", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "exceptions", "exc-a"), { tenantId: tenantAId, message: "error A" });
        await setDoc(doc(ctx.firestore(), "exceptions", "exc-b"), { tenantId: tenantBId, message: "error B" });
      });
      await assertSucceeds(getDoc(doc(db(tenantAUser), "exceptions", "exc-a")));
      await assertFails(getDoc(doc(db(tenantAUser), "exceptions", "exc-b")));
    });
  });
});
