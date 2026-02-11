/**
 * Invariant: Server-Only Writes
 * 
 * Certain collections can ONLY be written by the server (admin token).
 * Clients CANNOT create, update, or delete documents in these collections:
 * - tenants
 * - users  
 * - invoices
 * - bankTx
 * - matches
 * - events
 * - periods
 * - readmodels
 * - exports
 * - jobs
 * - exceptions
 */
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { initTestEnv } from "../helpers/testEnv";
import { shouldRunFirestoreEmulatorTests } from "../helpers/emulatorGuard";
import { doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;
let testEnv: RulesTestEnvironment;
const PROJECT_ID = "calybra-invariants-serveronly";

const ownerAuth = { uid: "user-owner", token: { admin: false } };
const serverAuth = { uid: "server", token: { admin: true } };
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
    await setDoc(doc(adminDb, "tenants", tenantId), { name: "Test Tenant" });
    await setDoc(doc(adminDb, "tenants", tenantId, "invoices", "inv-1"), { tenantId });
    await setDoc(doc(adminDb, "tenants", tenantId, "bankTx", "tx-1"), { tenantId, amount: 100 });
    await setDoc(doc(adminDb, "tenants", tenantId, "matches", "match-1"), { tenantId, status: "PROPOSED" });
    await setDoc(doc(adminDb, "tenants", tenantId, "events", "evt-1"), { tenantId, type: "BANK_TX_ARRIVED" });
    await setDoc(doc(adminDb, "tenants", tenantId, "periods", "2026-01"), { tenantId, status: "OPEN" });
    await setDoc(doc(adminDb, "tenants", tenantId, "readmodels", "monthCloseTimeline", "2026-01", "snapshot"), { tenantId });
    await setDoc(doc(adminDb, "tenants", tenantId, "exports", "2026-01", "artifacts", "ledgerCsv"), { tenantId });
    await setDoc(doc(adminDb, "jobs", "job-1"), { tenantId, status: "PENDING" });
    await setDoc(doc(adminDb, "exceptions", "exc-1"), { tenantId, message: "Error" });
  });
});

describeIfEmulator("INVARIANT: Server-Only Writes", () => {
  describe("/tenants collection", () => {
    it("client CANNOT create tenant", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", "client-tenant"), { name: "Client Created" }));
    });

    it("client CANNOT update tenant", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "tenants", tenantId), { name: "Updated" }));
    });

    it("client CANNOT delete tenant", async () => {
      await assertFails(deleteDoc(doc(db(ownerAuth), "tenants", tenantId)));
    });

    it("server CAN write to tenant", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", "server-tenant"), { name: "Server Created" }));
    });
  });

  describe("/users collection", () => {
    it("client CANNOT create user", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "users", "new-user"), { tenantId, role: "VIEWER" }));
    });

    it("client CANNOT update their own user doc", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "users", ownerAuth.uid), { role: "MANAGER" }));
    });

    it("server CAN write to users", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "users", "server-created-user"), { tenantId, role: "VIEWER" }));
    });
  });

  describe("/invoices subcollection", () => {
    it("client CANNOT create invoice", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "invoices", "client-inv"), { tenantId }));
    });

    it("client CANNOT update invoice", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "tenants", tenantId, "invoices", "inv-1"), { totalGross: 999 }));
    });

    it("client CANNOT delete invoice", async () => {
      await assertFails(deleteDoc(doc(db(ownerAuth), "tenants", tenantId, "invoices", "inv-1")));
    });

    it("server CAN write to invoices", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "invoices", "server-inv"), { tenantId }));
    });
  });

  describe("/bankTx subcollection", () => {
    it("client CANNOT create bankTx", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "bankTx", "client-tx"), { tenantId, amount: 50 }));
    });

    it("client CANNOT update bankTx", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "tenants", tenantId, "bankTx", "tx-1"), { amount: 200 }));
    });

    it("server CAN write to bankTx", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "bankTx", "server-tx"), { tenantId, amount: 300 }));
    });
  });

  describe("/matches subcollection", () => {
    it("client CANNOT create match", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "matches", "client-match"), { tenantId, status: "PROPOSED" }));
    });

    it("client CANNOT update match", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "tenants", tenantId, "matches", "match-1"), { status: "CONFIRMED" }));
    });

    it("server CAN write to matches", async () => {
      // Server must create matches with initial status PROPOSED (per state machine)
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "matches", "server-match"), { tenantId, status: "PROPOSED" }));
    });
  });

  describe("/events subcollection", () => {
    it("client CANNOT create event", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "events", "client-evt"), { tenantId }));
    });

    it("server CAN write to events", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "events", "server-evt"), { tenantId }));
    });
  });

  describe("/periods subcollection", () => {
    it("client CANNOT create period", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "periods", "2026-01"), { tenantId }));
    });

    it("server CAN write to periods", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "periods", "2026-02"), { tenantId }));
    });
  });

  describe("/readmodels subcollection", () => {
    it("client CANNOT create readmodel", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "readmodels", "monthCloseTimeline", "2026-01", "snapshot"), { tenantId }));
    });

    it("server CAN write to readmodels", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "readmodels", "monthCloseTimeline", "2026-02", "snapshot"), { tenantId }));
    });
  });

  describe("/exports subcollection", () => {
    it("client CANNOT create export", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "tenants", tenantId, "exports", "2026-01", "artifacts", "ledgerCsv"), { tenantId }));
    });

    it("server CAN write to exports", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "tenants", tenantId, "exports", "2026-02", "artifacts", "ledgerCsv"), { tenantId }));
    });
  });

  describe("/jobs collection", () => {
    it("client CANNOT create job", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "jobs", "client-job"), { tenantId, status: "PENDING" }));
    });

    it("client CANNOT update job", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "jobs", "job-1"), { status: "COMPLETED" }));
    });

    it("server CAN write to jobs", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "jobs", "server-job"), { tenantId, status: "RUNNING" }));
    });
  });

  describe("/exceptions collection", () => {
    it("client CANNOT create exception", async () => {
      await assertFails(setDoc(doc(db(ownerAuth), "exceptions", "client-exc"), { tenantId, message: "Forged" }));
    });

    it("client CANNOT update exception", async () => {
      await assertFails(updateDoc(doc(db(ownerAuth), "exceptions", "exc-1"), { resolved: true }));
    });

    it("server CAN write to exceptions", async () => {
      await assertSucceeds(setDoc(doc(db(serverAuth), "exceptions", "server-exc"), { tenantId, message: "Server Error" }));
    });
  });
});
