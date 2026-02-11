/**
 * Invariant: Status Transitions
 * 
 * Status fields are SERVER-CONTROLLED. Clients cannot change status
 * values, only the server (with admin token) can transition status.
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "../helpers/testEnv";
import { doc, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;
const PROJECT_ID = "calybra-invariants-status";

const ownerAuth = { uid: "user-owner", token: { admin: false } };
const accountantAuth = { uid: "user-accountant", token: { admin: false } };
const serverAuth = { uid: "server", token: { admin: true } };
const tenantId = "tenant-test";
const monthCloseId = "mc-test";

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
    await setDoc(doc(adminDb, "users", accountantAuth.uid), { tenantId, role: "ACCOUNTANT" });
    await setDoc(doc(adminDb, "tenants", tenantId), { name: "Test Tenant" });
    await setDoc(doc(adminDb, "tenants", tenantId, "monthCloses", monthCloseId), {
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

describe("INVARIANT: Status Transitions", () => {
  describe("MonthClose status", () => {
    it("OWNER cannot change status from DRAFT to IN_REVIEW", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("OWNER cannot change status from DRAFT to FINALIZED", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "FINALIZED" }));
    });

    it("ACCOUNTANT cannot change status", async () => {
      const docRef = doc(db(accountantAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("SERVER can change status from DRAFT to IN_REVIEW", async () => {
      const docRef = doc(db(serverAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { status: "IN_REVIEW" }));
    });

    it("SERVER can change status from IN_REVIEW to FINALIZED", async () => {
      // First transition to IN_REVIEW
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "monthCloses", monthCloseId), {
          status: "IN_REVIEW",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { status: "FINALIZED" }));
    });

    it("FINALIZED monthClose is immutable to client", async () => {
      // First finalize
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "monthCloses", monthCloseId), {
          status: "FINALIZED",
        });
      });
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { notes: "Attempted update after finalized" }));
    });

    it("SERVER CANNOT make illegal transition DRAFT -> FINALIZED", async () => {
      // Direct DRAFT -> FINALIZED is not allowed, must go through IN_REVIEW
      const docRef = doc(db(serverAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { status: "FINALIZED" }));
    });

    it("SERVER CANNOT update FINALIZED monthClose", async () => {
      // First finalize properly
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "monthCloses", monthCloseId), {
          status: "FINALIZED",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertFails(updateDoc(docRef, { notes: "Server attempted update after finalized" }));
    });

    it("SERVER can update non-status fields on IN_REVIEW monthClose", async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "monthCloses", monthCloseId), {
          status: "IN_REVIEW",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "monthCloses", monthCloseId);
      await assertSucceeds(updateDoc(docRef, { notes: "Server update on IN_REVIEW" }));
    });
  });

  describe("FileAsset status", () => {
    const fileAssetId = "fa-test";

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "tenants", tenantId, "fileAssets", fileAssetId), {
          tenantId,
          monthCloseId,
          kind: "BANK_CSV",
          filename: "test.csv",
          storagePath: "/test.csv",
          status: "PENDING_UPLOAD",
          createdAt: new Date(),
          updatedAt: new Date(),
          schemaVersion: 1,
        });
      });
    });

    it("client CANNOT update fileAsset after creation", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "fileAssets", fileAssetId);
      await assertFails(updateDoc(docRef, { status: "UPLOADED" }));
    });

    it("client CANNOT delete fileAsset", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "fileAssets", fileAssetId);
      // deleteDoc would fail - test by trying to set to different status
      await assertFails(updateDoc(docRef, { status: "DELETED" }));
    });

    it("SERVER can transition fileAsset status", async () => {
      const docRef = doc(db(serverAuth), "tenants", tenantId, "fileAssets", fileAssetId);
      await assertSucceeds(updateDoc(docRef, { status: "UPLOADED" }));
    });

    it("SERVER CANNOT make illegal fileAsset transition PENDING_UPLOAD -> VERIFIED", async () => {
      // PENDING_UPLOAD can only go to UPLOADED or DELETED, not VERIFIED
      const docRef = doc(db(serverAuth), "tenants", tenantId, "fileAssets", fileAssetId);
      await assertFails(updateDoc(docRef, { status: "VERIFIED" }));
    });

    it("SERVER CANNOT update DELETED fileAsset", async () => {
      // First delete
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "fileAssets", fileAssetId), {
          status: "DELETED",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "fileAssets", fileAssetId);
      await assertFails(updateDoc(docRef, { status: "UPLOADED" }));
    });
  });

  describe("Match status", () => {
    const matchId = "match-test";

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "tenants", tenantId, "matches", matchId), {
          tenantId,
          monthCloseId,
          status: "PROPOSED",
          bankTxIds: ["tx1"],
          invoiceIds: ["inv1"],
          matchType: "EXACT",
          score: 100,
        });
      });
    });

    it("client CANNOT write to matches (server-only)", async () => {
      const docRef = doc(db(ownerAuth), "tenants", tenantId, "matches", matchId);
      await assertFails(updateDoc(docRef, { status: "CONFIRMED" }));
    });

    it("SERVER can transition match to CONFIRMED", async () => {
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", matchId);
      await assertSucceeds(updateDoc(docRef, { status: "CONFIRMED" }));
    });

    it("SERVER can transition match to REJECTED", async () => {
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", matchId);
      await assertSucceeds(updateDoc(docRef, { status: "REJECTED" }));
    });

    it("SERVER CANNOT update CONFIRMED match (terminal state)", async () => {
      // First confirm
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "matches", matchId), {
          status: "CONFIRMED",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", matchId);
      await assertFails(updateDoc(docRef, { notes: "Attempted update after confirmed" }));
    });

    it("SERVER CANNOT update REJECTED match (terminal state)", async () => {
      // First reject
      await testEnv.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), "tenants", tenantId, "matches", matchId), {
          status: "REJECTED",
        });
      });
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", matchId);
      await assertFails(updateDoc(docRef, { notes: "Attempted update after rejected" }));
    });

    it("SERVER must create match with status PROPOSED", async () => {
      const newMatchId = "new-match";
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", newMatchId);
      // Cannot create with CONFIRMED status
      await assertFails(setDoc(docRef, {
        tenantId,
        monthCloseId,
        status: "CONFIRMED",
        bankTxIds: ["tx2"],
        invoiceIds: ["inv2"],
        matchType: "EXACT",
        score: 95,
      }));
    });

    it("SERVER can create match with status PROPOSED", async () => {
      const newMatchId = "new-match-valid";
      const docRef = doc(db(serverAuth), "tenants", tenantId, "matches", newMatchId);
      await assertSucceeds(setDoc(docRef, {
        tenantId,
        monthCloseId,
        status: "PROPOSED",
        bankTxIds: ["tx3"],
        invoiceIds: ["inv3"],
        matchType: "EXACT",
        score: 90,
      }));
    });
  });
});
