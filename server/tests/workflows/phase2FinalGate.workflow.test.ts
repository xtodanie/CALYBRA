import admin from "firebase-admin";
import { runPhase2FinalGateWorkflow } from "../../../server/workflows/phase2FinalGate.workflow";
import { shouldRunFirestoreEmulatorTests } from "../../../tests/helpers/emulatorGuard";

jest.setTimeout(20000);

const PROJECT_ID = "calybra-phase2-final-gate-test";

function getAdminApp() {
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: PROJECT_ID });
  }
  return admin.app();
}

const describeIfEmulator = shouldRunFirestoreEmulatorTests() ? describe : describe.skip;

describeIfEmulator("phase2FinalGate.workflow", () => {
  const tenantId = "tenant-final-gate";
  const monthKey = "2026-01";

  beforeAll(() => {
    getAdminApp();
  });

  beforeEach(async () => {
    const db = admin.firestore();
    await db.recursiveDelete(db.collection("tenants").doc(tenantId));

    const basePath = db
      .collection("tenants")
      .doc(tenantId)
      .collection("readmodels")
      .doc("brainArtifacts")
      .collection("items");

    const artifacts = [
      {
        artifactId: "brain:2026-01:event_log:a1",
        tenantId,
        monthKey,
        type: "event_log",
        generatedAt: "2026-02-13T10:00:00Z",
        hash: "a".repeat(64),
        payload: {
          replayHash: "rh-1",
          events: [
            { id: "e1" },
            { id: "e2", parent_id: "e1" },
          ],
        },
      },
      {
        artifactId: "brain:2026-01:decision:a2",
        tenantId,
        monthKey,
        type: "decision",
        generatedAt: "2026-02-13T10:01:00Z",
        hash: "b".repeat(64),
        payload: {
          accepted: true,
        },
      },
      {
        artifactId: "brain:2026-01:event_log:a3",
        tenantId,
        monthKey,
        type: "event_log",
        generatedAt: "2026-02-13T10:02:00Z",
        hash: "c".repeat(64),
        payload: {
          replayHash: "rh-1",
          events: [
            { id: "e1" },
            { id: "e2", parent_id: "e1" },
            { id: "e3", parent_id: "e2" },
          ],
        },
      },
    ];

    for (const artifact of artifacts) {
      await basePath.doc(artifact.artifactId).set(artifact);
    }
  });

  it("computes and persists final gate report", async () => {
    const db = admin.firestore();
    const result = await runPhase2FinalGateWorkflow(db, {
      tenantId,
      monthKey,
      actorId: "system",
      now: admin.firestore.Timestamp.now(),
    });

    expect(result.success).toBe(true);

    const reportDoc = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("readmodels")
      .doc("phase2FinalGate")
      .collection("items")
      .doc(monthKey)
      .get();

    expect(reportDoc.exists).toBe(true);
    const report = reportDoc.data() as Record<string, unknown>;
    expect(report["schemaVersion"]).toBe(1);
    expect(report["freeze"]).toBeDefined();
  });
});
