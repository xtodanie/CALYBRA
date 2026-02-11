/**
 * INVARIANT TESTS - STEP 6
 * 
 * These tests prove the system is safe even if someone tries to break it.
 * They are hostile tests, not happy-path tests.
 * 
 * REQUIRED INVARIANTS:
 * - Cross-tenant access is denied
 * - VIEWER cannot create a MonthClose
 * - Client cannot finalize a MonthClose
 * - Illegal status transitions are blocked
 * - FINALIZED entities are immutable
 * - Forbidden fields cannot be written by client
 */

import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "./helpers/testEnv";
import { shouldRunFirestoreEmulatorTests } from "./helpers/emulatorGuard";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } from "firebase/firestore";

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;
let testEnv: RulesTestEnvironment;

const PROJECT_ID = "calybra-invariant-tests";

// Auth contexts
const ownerAuth = { uid: "owner-uid", token: { admin: false } };
const accountantAuth = { uid: "accountant-uid", token: { admin: false } };
const viewerAuth = { uid: "viewer-uid", token: { admin: false } };
const otherTenantAuth = { uid: "other-tenant-uid", token: { admin: false } };
const serverAuth = { uid: "server-uid", token: { admin: true } };

// Tenant IDs
const myTenantId = "tenant-alpha";
const otherTenantId = "tenant-beta";
const monthCloseId = "mc-001";

type AuthInput = { uid: string; token?: { admin: boolean } };

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

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();

    // Seed users
    await setDoc(doc(adminDb, "users", ownerAuth.uid), {
      tenantId: myTenantId,
      role: "OWNER",
    });
    await setDoc(doc(adminDb, "users", accountantAuth.uid), {
      tenantId: myTenantId,
      role: "ACCOUNTANT",
    });
    await setDoc(doc(adminDb, "users", viewerAuth.uid), {
      tenantId: myTenantId,
      role: "VIEWER",
    });
    await setDoc(doc(adminDb, "users", otherTenantAuth.uid), {
      tenantId: otherTenantId,
      role: "OWNER",
    });

    // Seed a DRAFT monthClose for my tenant
    await setDoc(doc(adminDb, "tenants", myTenantId, "monthCloses", monthCloseId), {
      tenantId: myTenantId,
      status: "DRAFT",
      periodStart: Timestamp.now(),
      periodEnd: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: ownerAuth.uid,
      updatedBy: ownerAuth.uid,
      schemaVersion: 1,
    });

    // Seed a DRAFT monthClose for other tenant
    await setDoc(doc(adminDb, "tenants", otherTenantId, "monthCloses", "mc-other"), {
      tenantId: otherTenantId,
      status: "DRAFT",
      periodStart: Timestamp.now(),
      periodEnd: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: otherTenantAuth.uid,
      updatedBy: otherTenantAuth.uid,
      schemaVersion: 1,
    });
  });
});

describeIfEmulator("INVARIANT TESTS - Security Enforcement", () => {
  // =========================================================================
  // INVARIANT 1: Cross-tenant access is denied
  // =========================================================================
  describe("Cross-Tenant Isolation", () => {
    it("rejects read of other tenant's monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", otherTenantId, "monthCloses", "mc-other");
      await assertFails(getDoc(docRef));
    });

    it("rejects write to other tenant's monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", otherTenantId, "monthCloses", "mc-other");
      await assertFails(updateDoc(docRef, { notes: "hacked" }));
    });

    it("rejects create in other tenant's collection", async () => {
      const docRef = doc(db(ownerAuth), "tenants", otherTenantId, "monthCloses", "mc-hacked");
      await assertFails(
        setDoc(docRef, {
          tenantId: otherTenantId,
          status: "DRAFT",
          periodStart: Timestamp.now(),
          periodEnd: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: ownerAuth.uid,
          updatedBy: ownerAuth.uid,
          schemaVersion: 1,
        })
      );
    });

    it("rejects forged tenantId on create", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", "mc-forged");
      await assertFails(
        setDoc(docRef, {
          tenantId: otherTenantId, // Forged!
          status: "DRAFT",
          periodStart: Timestamp.now(),
          periodEnd: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: ownerAuth.uid,
          updatedBy: ownerAuth.uid,
          schemaVersion: 1,
        })
      );
    });
  });

  // =========================================================================
  // INVARIANT 2: VIEWER cannot create a MonthClose
  // =========================================================================
  describe("VIEWER Role Restrictions", () => {
    it("VIEWER cannot create monthClose", async () => {
      const docRef = doc(db(viewerAuth), "tenants", myTenantId, "monthCloses", "mc-viewer");
      await assertFails(
        setDoc(docRef, {
          tenantId: myTenantId,
          status: "DRAFT",
          periodStart: Timestamp.now(),
          periodEnd: Timestamp.now(),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          createdBy: viewerAuth.uid,
          updatedBy: viewerAuth.uid,
          schemaVersion: 1,
        })
      );
    });

    it("VIEWER cannot update monthClose", async () => {
      const docRef = doc(db(viewerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { notes: "viewer was here" }));
    });

    it("VIEWER can read monthClose", async () => {
      const docRef = doc(db(viewerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertSucceeds(getDoc(docRef));
    });
  });

  // =========================================================================
  // INVARIANT 3: Client cannot finalize a MonthClose (status change blocked)
  // =========================================================================
  describe("Client Cannot Change Status", () => {
    it("OWNER cannot change status from DRAFT to IN_REVIEW", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("OWNER cannot finalize a DRAFT monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "FINALIZED" }));
    });

    it("ACCOUNTANT cannot change status", async () => {
      const docRef = doc(db(accountantAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("server CAN change status", async () => {
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { status: "IN_REVIEW" }));
    });
  });

  // =========================================================================
  // INVARIANT 4: Illegal status transitions are blocked (server-side tested separately)
  // =========================================================================
  describe("Server Must Respect Transition Rules", () => {
    it("server can transition DRAFT -> IN_REVIEW", async () => {
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("server can transition IN_REVIEW -> FINALIZED", async () => {
      // First transition to IN_REVIEW
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await updateDoc(doc(adminDb, "tenants", myTenantId, "monthCloses", monthCloseId), {
          status: "IN_REVIEW",
        });
      });

      const docRef = doc(db(serverAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { status: "FINALIZED" }));
    });
  });

  // =========================================================================
  // INVARIANT 5: FINALIZED entities are immutable
  // =========================================================================
  describe("FINALIZED Immutability", () => {
    beforeEach(async () => {
      // Set the monthClose to FINALIZED
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await updateDoc(doc(adminDb, "tenants", myTenantId, "monthCloses", monthCloseId), {
          status: "FINALIZED",
        });
      });
    });

    it("OWNER cannot update a FINALIZED monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { notes: "tried to edit" }));
    });

    it("OWNER cannot change status of FINALIZED monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "DRAFT" }));
    });

    it("OWNER cannot delete a FINALIZED monthClose", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(deleteDoc(docRef));
    });

    it("server CANNOT update a FINALIZED monthClose", async () => {
      // Terminal state immutability applies to ALL actors including server
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { notes: "admin correction" }));
    });
  });

  // =========================================================================
  // INVARIANT 6: Forbidden fields cannot be written by client
  // =========================================================================
  describe("Server-Only Fields Protection", () => {
    it("client cannot overwrite createdAt", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { createdAt: Timestamp.now() }));
    });

    it("client cannot overwrite createdBy", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { createdBy: "hacker-uid" }));
    });

    it("client cannot overwrite tenantId", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { tenantId: otherTenantId }));
    });

    it("client can update allowed fields (notes)", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "monthCloses", monthCloseId);
      // Only update notes, keep status same
      await assertSucceeds(updateDoc(docRef, { notes: "allowed update" }));
    });
  });

  // =========================================================================
  // INVARIANT 7: fileAssets are server-only for updates
  // =========================================================================
  describe("FileAsset Server-Only Updates", () => {
    const fileAssetId = "fa-001";

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "tenants", myTenantId, "fileAssets", fileAssetId), {
          tenantId: myTenantId,
          monthCloseId: monthCloseId,
          kind: "BANK_CSV",
          filename: "test.csv",
          storagePath: "path/to/test.csv",
          status: "PENDING_UPLOAD",
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          schemaVersion: 1,
        });
      });
    });

    it("client cannot update fileAsset", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "fileAssets", fileAssetId);
      await assertFails(updateDoc(docRef, { status: "UPLOADED" }));
    });

    it("client cannot delete fileAsset", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "fileAssets", fileAssetId);
      await assertFails(deleteDoc(docRef));
    });

    it("server can update fileAsset", async () => {
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "fileAssets", fileAssetId);
      await assertSucceeds(updateDoc(docRef, { status: "UPLOADED" }));
    });
  });

  // =========================================================================
  // INVARIANT 8: Matches are server-only
  // =========================================================================
  describe("Match Server-Only Writes", () => {
    it("client cannot create a match", async () => {
      const docRef = doc(db(ownerAuth), "tenants", myTenantId, "matches", "match-001");
      await assertFails(
        setDoc(docRef, {
          tenantId: myTenantId,
          monthCloseId: monthCloseId,
          bankTxIds: ["tx-1"],
          invoiceIds: ["inv-1"],
          matchType: "EXACT",
          score: 100,
          status: "PROPOSED",
          explanationKey: "exact_match",
          explanationParams: {},
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          schemaVersion: 1,
        })
      );
    });

    it("server can create a match", async () => {
      const docRef = doc(db(serverAuth), "tenants", myTenantId, "matches", "match-001");
      await assertSucceeds(
        setDoc(docRef, {
          tenantId: myTenantId,
          monthCloseId: monthCloseId,
          status: "PROPOSED",
        })
      );
    });
  });
});
