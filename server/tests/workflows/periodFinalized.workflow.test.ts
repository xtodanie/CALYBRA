/**
 * Period Finalized Workflow Integration Tests
 */

import admin from "firebase-admin";
import { onPeriodFinalizedWorkflow } from "../../../server/workflows/onPeriodFinalized.workflow";
import { shouldRunFirestoreEmulatorTests } from "../../../tests/helpers/emulatorGuard";

jest.setTimeout(20000);

const PROJECT_ID = "calybra-period-finalized-test";

function getAdminApp() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.app();
}

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;

describeIfEmulator("onPeriodFinalizedWorkflow", () => {
  const tenantId = "tenant-test";
  const monthKey = "2026-01";

  beforeAll(() => {
    getAdminApp();
  });

  beforeEach(async () => {
    const db = admin.firestore();
    await db.recursiveDelete(db.collection("tenants").doc(tenantId));
    await db.recursiveDelete(db.collection("jobs"));

    await db.collection("tenants").doc(tenantId).set({
      tenantId,
      name: "Test Tenant",
      currency: "EUR",
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      createdBy: "system",
      updatedBy: "system",
      schemaVersion: 1,
    });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("periods")
      .doc(monthKey)
      .set({
        id: monthKey,
        tenantId,
        status: "FINALIZED",
        finalizedAt: admin.firestore.Timestamp.now(),
        closeConfig: { asOfDays: [5, 10] },
        schemaVersion: 1,
      });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("events")
      .doc("evt-1")
      .set({
        id: "evt-1",
        tenantId,
        type: "BANK_TX_ARRIVED",
        occurredAt: "2026-01-02T00:00:00Z",
        recordedAt: "2026-01-02T00:01:00Z",
        monthKey,
        deterministicId: "tx-1",
        payload: {
          txId: "tx-1",
          bookingDate: "2026-01-02",
          amountCents: 10000,
          currency: "EUR",
          descriptionRaw: "Sale",
        },
        schemaVersion: 1,
      });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("events")
      .doc("evt-2")
      .set({
        id: "evt-2",
        tenantId,
        type: "INVOICE_CREATED",
        occurredAt: "2026-01-03T00:00:00Z",
        recordedAt: "2026-01-03T00:01:00Z",
        monthKey,
        deterministicId: "inv-1",
        payload: {
          invoiceId: "inv-1",
          issueDate: "2026-01-03",
          invoiceNumber: "INV-1",
          supplierNameRaw: "Supplier",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "EUR",
        },
        schemaVersion: 1,
      });
  });

  it("writes readmodels and exports", async () => {
    const db = admin.firestore();
    const result = await onPeriodFinalizedWorkflow(db, {
      tenantId,
      monthKey,
      actorId: "system",
      now: admin.firestore.Timestamp.now(),
      currency: "EUR",
    });

    expect(result.success).toBe(true);

    const timelineDoc = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("readmodels")
      .doc("monthCloseTimeline")
      .collection(monthKey)
      .doc("snapshot")
      .get();

    expect(timelineDoc.exists).toBe(true);

    const ledgerDoc = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("exports")
      .doc(monthKey)
      .collection("artifacts")
      .doc("ledgerCsv")
      .get();

    expect(ledgerDoc.exists).toBe(true);

    const jobSnapshot = await db.collection("jobs").get();
    expect(jobSnapshot.empty).toBe(false);

    const brainArtifacts = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("readmodels")
      .doc("brainArtifacts")
      .collection("items")
      .get();

    expect(brainArtifacts.empty).toBe(false);
    const artifactTypes = new Set(
      brainArtifacts.docs.map((doc) => (doc.data() as Record<string, unknown>)["type"] as string)
    );
    expect(artifactTypes.has("decision")).toBe(true);
    expect(artifactTypes.has("event_log")).toBe(true);
  });

  it("is idempotent with job record", async () => {
    const db = admin.firestore();
    const first = await onPeriodFinalizedWorkflow(db, {
      tenantId,
      monthKey,
      actorId: "system",
      now: admin.firestore.Timestamp.now(),
      currency: "EUR",
    });

    expect(first.success).toBe(true);

    const second = await onPeriodFinalizedWorkflow(db, {
      tenantId,
      monthKey,
      actorId: "system",
      now: admin.firestore.Timestamp.now(),
      currency: "EUR",
    });

    expect(second.success).toBe(true);

    const artifactsSnapshot = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("readmodels")
      .doc("brainArtifacts")
      .collection("items")
      .get();

    expect(artifactsSnapshot.empty).toBe(false);
    const decisionHashes = artifactsSnapshot.docs
      .filter((doc) => (doc.data() as Record<string, unknown>)["type"] === "decision")
      .map((doc) => (doc.data() as Record<string, unknown>)["hash"] as string);

    expect(new Set(decisionHashes).size).toBe(decisionHashes.length);
  });
});
