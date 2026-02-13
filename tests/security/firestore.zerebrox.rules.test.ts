import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { initTestEnv } from "../helpers/testEnv";
import { shouldRunFirestoreEmulatorTests } from "../helpers/emulatorGuard";

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;
let testEnv: RulesTestEnvironment;

const PROJECT_ID = "calybra-zerebrox-rules";
const tenantA = "tenant-a";
const tenantB = "tenant-b";
const monthKey = "2026-02";

const ownerA = { uid: "owner-a", token: { admin: false } };
const ownerB = { uid: "owner-b", token: { admin: false } };
const server = { uid: "server", token: { admin: true } };

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
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, "users", ownerA.uid), { tenantId: tenantA, role: "OWNER" });
    await setDoc(doc(adminDb, "users", ownerB.uid), { tenantId: tenantB, role: "OWNER" });
    await setDoc(doc(adminDb, "tenants", tenantA), { name: "Tenant A" });
    await setDoc(doc(adminDb, "tenants", tenantB), { name: "Tenant B" });

    await setDoc(
      doc(adminDb, "tenants", tenantA, "readmodels", "flightRecorder", monthKey, "snapshot"),
      { tenantId: tenantA, monthKey, timeline: [], schemaVersion: 1 }
    );
    await setDoc(
      doc(adminDb, "tenants", tenantA, "events", "evt-seeded"),
      { tenantId: tenantA, type: "zerebrox.decision", schemaVersion: 1 }
    );
  });
});

describeIfEmulator("ZEREBROX Firestore rules hardening", () => {
  it("prevents clients from writing control-plane events and readmodels", async () => {
    const clientEvent = doc(db(ownerA), "tenants", tenantA, "events", "evt-client");
    await assertFails(
      setDoc(clientEvent, {
        tenantId: tenantA,
        type: "zerebrox.decision",
        monthKey,
      })
    );

    const clientReadmodel = doc(
      db(ownerA),
      "tenants",
      tenantA,
      "readmodels",
      "flightRecorder",
      monthKey,
      "snapshot"
    );
    await assertFails(setDoc(clientReadmodel, { tenantId: tenantA, monthKey }));
  });

  it("allows server writes for control-plane events and readmodels", async () => {
    const serverEvent = doc(db(server), "tenants", tenantA, "events", "evt-server");
    await assertSucceeds(
      setDoc(serverEvent, {
        tenantId: tenantA,
        type: "zerebrox.truth_link",
        monthKey,
        schemaVersion: 1,
      })
    );

    const serverReadmodel = doc(
      db(server),
      "tenants",
      tenantA,
      "readmodels",
      "controlPlaneRuns",
      "items",
      `${monthKey}:nightly`
    );
    await assertSucceeds(
      setDoc(serverReadmodel, {
        tenantId: tenantA,
        monthKey,
        tier: "nightly",
        schemaVersion: 1,
      })
    );
  });

  it("enforces tenant-scoped reads on control-plane artifacts", async () => {
    const ownRead = doc(db(ownerA), "tenants", tenantA, "readmodels", "flightRecorder", monthKey, "snapshot");
    await assertSucceeds(getDoc(ownRead));

    const crossRead = doc(db(ownerA), "tenants", tenantB, "readmodels", "flightRecorder", monthKey, "snapshot");
    await assertFails(getDoc(crossRead));
  });
});
