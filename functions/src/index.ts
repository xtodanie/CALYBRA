import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { onPeriodFinalizedWorkflow } from "../../server/workflows/onPeriodFinalized.workflow";
import {
  approveZerebroxPolicyProposalWorkflow,
  runZerebroxControlPlaneHeartbeatWorkflow,
} from "../../server/workflows/zerebroxControlPlane.workflow";
import type { CurrencyCode } from "../../server/domain/money";

admin.initializeApp();

const db = admin.firestore();

const ALLOWED_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"] as const;

function monthKeyFromDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

async function requireUser(context: functions.https.CallableContext) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }

  const uid = context.auth.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError("not-found", "User not found.");
  }

  const userData = userDoc.data() as { tenantId: string; role: string };
  if (!ALLOWED_ROLES.includes(userData.role as typeof ALLOWED_ROLES[number])) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You do not have permission to access this resource."
    );
  }

  return { uid, tenantId: userData.tenantId, role: userData.role };
}

/**
 * Simulates a job process by updating the job document in Firestore through several steps.
 * This is triggered whenever a new document is created in the 'jobs' collection.
 */
export const processJob = functions.firestore
  .document("jobs/{jobId}")
  .onCreate(async (
    snap: functions.firestore.QueryDocumentSnapshot,
    context: functions.EventContext<{ jobId: string }>
  ) => {
    const {jobId} = context.params;
    const jobRef = db.collection("jobs").doc(jobId);

    const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

    const steps = [
      {
        status: "RUNNING",
        progress: {stepKey: "jobs.steps.downloading", pct: 20},
        delay: 1000,
      },
      {
        status: "RUNNING",
        progress: {stepKey: "jobs.steps.preparing", pct: 50},
        delay: 2000,
      },
      {
        status: "RUNNING",
        progress: {stepKey: "jobs.steps.finalizing", pct: 90},
        delay: 1500,
      },
      {
        status: "COMPLETED",
        progress: {stepKey: "jobs.steps.completed", pct: 100},
        delay: 500,
      },
    ];

    try {
      // Set initial status to running
      await jobRef.update({
          status: "RUNNING",
          progress: { stepKey: 'jobs.steps.queued', pct: 1 },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      for (const step of steps) {
        await delay(step.delay);
        await jobRef.update({
          status: step.status,
          progress: step.progress,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      functions.logger.error(`Job ${jobId} failed`, error);
      await jobRef.update({
        status: "FAILED",
        error: {
          code: "JOB_EXECUTION_FAILED",
          messageKey: "jobs.errors.GENERIC",
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

/**
 * Creates and returns a short-lived signed URL for a file in Firebase Storage.
 * This function is callable from the client and enforces role-based access control.
 */
export const getSignedDownloadUrl = functions.https.onCall(
  async (
    data: { fileAssetId?: string },
    context: functions.https.CallableContext
  ) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }
    const uid = context.auth.uid;
    const {fileAssetId} = data;

    if (!fileAssetId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        'The function must be called with a "fileAssetId" argument.'
      );
    }

    try {
      const userDocRef = db.collection("users").doc(uid);
      const userDoc = await userDocRef.get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
      }
      const userData = userDoc.data()!;
      const fileAssetRef = db
        .collection("tenants")
        .doc(userData.tenantId)
        .collection("fileAssets")
        .doc(fileAssetId);
      const fileAssetDoc = await fileAssetRef.get();

      if (!fileAssetDoc.exists) {
        throw new functions.https.HttpsError("not-found", "File not found.");
      }

      const fileAssetData = fileAssetDoc.data()!;

      const allowedRoles = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"];
      if (!allowedRoles.includes(userData.role)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to download this file."
        );
      }

      if (userData.tenantId !== fileAssetData.tenantId) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to access this file."
        );
      }

      if (!String(fileAssetData.storagePath || "").startsWith(`tenants/${userData.tenantId}/`)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permission to access this file."
        );
      }

      const expiryDate = new Date();
      expiryDate.setMinutes(expiryDate.getMinutes() + 15);

      const [url] = await admin.storage()
        .bucket()
        .file(fileAssetData.storagePath)
        .getSignedUrl({
          action: "read",
          expires: expiryDate,
        });

      return {url, expiresAt: expiryDate.toISOString()};
    } catch (error) {
      functions.logger.error(
        `Failed to get signed URL for fileAssetId: ${fileAssetId}`,
        error
      );
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        "internal",
        "An unexpected error occurred."
      );
    }
  }
);

/**
 * Trigger: Period finalized -> compute readmodels + exports
 */
export const onPeriodFinalized = functions.firestore
  .document("tenants/{tenantId}/periods/{monthKey}")
  .onWrite(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();

    if (!after || after.status !== "FINALIZED") {
      return null;
    }

    if (before && before.status === "FINALIZED") {
      return null;
    }

    const { tenantId, monthKey } = context.params as {
      tenantId: string;
      monthKey: string;
    };

    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
      functions.logger.warn("Tenant not found for period", { tenantId, monthKey });
      return null;
    }

    const tenantData = tenantDoc.data() as { currency?: CurrencyCode };
    const currency = tenantData.currency ?? "EUR";

    await onPeriodFinalizedWorkflow(db, {
      tenantId,
      monthKey,
      actorId: "system",
      now: admin.firestore.Timestamp.now(),
      currency,
    });

    return null;
  });

export const getMonthCloseTimeline = functions.https.onCall(
  async (data: { monthKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey) {
      throw new functions.https.HttpsError("invalid-argument", "monthKey is required");
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("monthCloseTimeline")
      .collection(data.monthKey)
      .doc("snapshot")
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Timeline not found");
    }

    return doc.data();
  }
);

export const getCloseFriction = functions.https.onCall(
  async (data: { monthKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey) {
      throw new functions.https.HttpsError("invalid-argument", "monthKey is required");
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("closeFriction")
      .collection(data.monthKey)
      .doc("snapshot")
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Close friction not found");
    }

    return doc.data();
  }
);

export const getVatSummary = functions.https.onCall(
  async (data: { monthKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey) {
      throw new functions.https.HttpsError("invalid-argument", "monthKey is required");
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("vatSummary")
      .collection(data.monthKey)
      .doc("snapshot")
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "VAT summary not found");
    }

    return doc.data();
  }
);

export const getMismatchSummary = functions.https.onCall(
  async (data: { monthKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey) {
      throw new functions.https.HttpsError("invalid-argument", "monthKey is required");
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("mismatchSummary")
      .collection(data.monthKey)
      .doc("snapshot")
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Mismatch summary not found");
    }

    return doc.data();
  }
);

export const getAuditorReplay = functions.https.onCall(
  async (data: { monthKey?: string; asOfDateKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey || !data.asOfDateKey) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "monthKey and asOfDateKey are required"
      );
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("auditorReplay")
      .collection(data.monthKey)
      .doc(data.asOfDateKey)
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Snapshot not found");
    }

    return doc.data();
  }
);

export const getExportArtifact = functions.https.onCall(
  async (data: { monthKey?: string; artifactId?: "ledgerCsv" | "summaryPdf" }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey || !data.artifactId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "monthKey and artifactId are required"
      );
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("exports")
      .doc(data.monthKey)
      .collection("artifacts")
      .doc(data.artifactId)
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Export not found");
    }

    return doc.data();
  }
);

export const getFlightRecorder = functions.https.onCall(
  async (data: { monthKey?: string }, context) => {
    const user = await requireUser(context);
    if (!data.monthKey) {
      throw new functions.https.HttpsError("invalid-argument", "monthKey is required");
    }

    const doc = await db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("readmodels")
      .doc("flightRecorder")
      .collection(data.monthKey)
      .doc("snapshot")
      .get();

    if (!doc.exists) {
      throw new functions.https.HttpsError("not-found", "Flight recorder not found");
    }

    return doc.data();
  }
);

export const approvePolicyProposal = functions.https.onCall(
  async (
    data: {
      proposalId?: string;
      monthKey?: string;
      candidatePolicyVersion?: string;
      baselinePolicyVersion?: string;
      regressionPrecisionDelta?: number;
      regressionRecallDelta?: number;
    },
    context
  ) => {
    const user = await requireUser(context);
    if (!data.proposalId || !data.monthKey || !data.candidatePolicyVersion || !data.baselinePolicyVersion) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "proposalId, monthKey, candidatePolicyVersion and baselinePolicyVersion are required"
      );
    }

    if (!(user.role === "OWNER" || user.role === "MANAGER")) {
      throw new functions.https.HttpsError("permission-denied", "Only OWNER or MANAGER can approve policy proposals");
    }

    const result = await approveZerebroxPolicyProposalWorkflow(db, {
      tenantId: user.tenantId,
      proposalId: data.proposalId,
      actorId: user.uid,
      now: admin.firestore.Timestamp.now(),
      candidatePolicyVersion: data.candidatePolicyVersion,
      baselinePolicyVersion: data.baselinePolicyVersion,
      regressionPrecisionDelta: data.regressionPrecisionDelta ?? 0,
      regressionRecallDelta: data.regressionRecallDelta ?? 0,
    });

    return result;
  }
);

export const controlPlaneHeartbeatHourly = functions.pubsub
  .schedule("every 60 minutes")
  .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());

    for (const tenant of tenantSnapshots.docs) {
      await runZerebroxControlPlaneHeartbeatWorkflow(db, {
        tenantId: tenant.id,
        monthKey,
        now,
        actorId: "system",
        tier: "nightly",
      });
    }

    return null;
  });

export const controlPlaneAdaptationNightly = functions.pubsub
  .schedule("every day 02:00")
  .timeZone("UTC")
  .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());

    for (const tenant of tenantSnapshots.docs) {
      await runZerebroxControlPlaneHeartbeatWorkflow(db, {
        tenantId: tenant.id,
        monthKey,
        now,
        actorId: "system",
        tier: "nightly",
      });
    }

    return null;
  });

export const controlPlaneAdaptationWeekly = functions.pubsub
  .schedule("every sunday 03:00")
  .timeZone("UTC")
  .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());

    for (const tenant of tenantSnapshots.docs) {
      await runZerebroxControlPlaneHeartbeatWorkflow(db, {
        tenantId: tenant.id,
        monthKey,
        now,
        actorId: "system",
        tier: "weekly",
      });
    }

    return null;
  });
