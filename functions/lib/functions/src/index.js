"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.controlPlaneAdaptationWeekly = exports.controlPlaneAdaptationNightly = exports.controlPlaneHeartbeatHourly = exports.approvePolicyProposal = exports.getFlightRecorder = exports.getExportArtifact = exports.getAuditorReplay = exports.getMismatchSummary = exports.getVatSummary = exports.getCloseFriction = exports.getMonthCloseTimeline = exports.onPeriodFinalized = exports.getSignedDownloadUrl = exports.processJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const onPeriodFinalized_workflow_1 = require("../../server/workflows/onPeriodFinalized.workflow");
const zerebroxControlPlane_workflow_1 = require("../../server/workflows/zerebroxControlPlane.workflow");
admin.initializeApp();
const db = admin.firestore();
const ALLOWED_ROLES = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"];
function monthKeyFromDate(value) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
}
async function requireUser(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const uid = context.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
    }
    const userData = userDoc.data();
    if (!ALLOWED_ROLES.includes(userData.role)) {
        throw new functions.https.HttpsError("permission-denied", "You do not have permission to access this resource.");
    }
    return { uid, tenantId: userData.tenantId, role: userData.role };
}
/**
 * Simulates a job process by updating the job document in Firestore through several steps.
 * This is triggered whenever a new document is created in the 'jobs' collection.
 */
exports.processJob = functions.firestore
    .document("jobs/{jobId}")
    .onCreate(async (snap, context) => {
    const { jobId } = context.params;
    const jobRef = db.collection("jobs").doc(jobId);
    const delay = (ms) => new Promise((res) => setTimeout(res, ms));
    const steps = [
        {
            status: "RUNNING",
            progress: { stepKey: "jobs.steps.downloading", pct: 20 },
            delay: 1000,
        },
        {
            status: "RUNNING",
            progress: { stepKey: "jobs.steps.preparing", pct: 50 },
            delay: 2000,
        },
        {
            status: "RUNNING",
            progress: { stepKey: "jobs.steps.finalizing", pct: 90 },
            delay: 1500,
        },
        {
            status: "COMPLETED",
            progress: { stepKey: "jobs.steps.completed", pct: 100 },
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
    }
    catch (error) {
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
exports.getSignedDownloadUrl = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "The function must be called while authenticated.");
    }
    const uid = context.auth.uid;
    const { fileAssetId } = data;
    if (!fileAssetId) {
        throw new functions.https.HttpsError("invalid-argument", 'The function must be called with a "fileAssetId" argument.');
    }
    try {
        const userDocRef = db.collection("users").doc(uid);
        const userDoc = await userDocRef.get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError("not-found", "User not found.");
        }
        const userData = userDoc.data();
        const fileAssetRef = db
            .collection("tenants")
            .doc(userData.tenantId)
            .collection("fileAssets")
            .doc(fileAssetId);
        const fileAssetDoc = await fileAssetRef.get();
        if (!fileAssetDoc.exists) {
            throw new functions.https.HttpsError("not-found", "File not found.");
        }
        const fileAssetData = fileAssetDoc.data();
        const allowedRoles = ["OWNER", "MANAGER", "ACCOUNTANT", "VIEWER"];
        if (!allowedRoles.includes(userData.role)) {
            throw new functions.https.HttpsError("permission-denied", "You do not have permission to download this file.");
        }
        if (userData.tenantId !== fileAssetData.tenantId) {
            throw new functions.https.HttpsError("permission-denied", "You do not have permission to access this file.");
        }
        if (!String(fileAssetData.storagePath || "").startsWith(`tenants/${userData.tenantId}/`)) {
            throw new functions.https.HttpsError("permission-denied", "You do not have permission to access this file.");
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
        return { url, expiresAt: expiryDate.toISOString() };
    }
    catch (error) {
        functions.logger.error(`Failed to get signed URL for fileAssetId: ${fileAssetId}`, error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError("internal", "An unexpected error occurred.");
    }
});
/**
 * Trigger: Period finalized -> compute readmodels + exports
 */
exports.onPeriodFinalized = functions.firestore
    .document("tenants/{tenantId}/periods/{monthKey}")
    .onWrite(async (change, context) => {
    var _a;
    const after = change.after.data();
    const before = change.before.data();
    if (!after || after.status !== "FINALIZED") {
        return null;
    }
    if (before && before.status === "FINALIZED") {
        return null;
    }
    const { tenantId, monthKey } = context.params;
    const tenantDoc = await db.collection("tenants").doc(tenantId).get();
    if (!tenantDoc.exists) {
        functions.logger.warn("Tenant not found for period", { tenantId, monthKey });
        return null;
    }
    const tenantData = tenantDoc.data();
    const currency = (_a = tenantData.currency) !== null && _a !== void 0 ? _a : "EUR";
    await (0, onPeriodFinalized_workflow_1.onPeriodFinalizedWorkflow)(db, {
        tenantId,
        monthKey,
        actorId: "system",
        now: admin.firestore.Timestamp.now(),
        currency,
    });
    return null;
});
exports.getMonthCloseTimeline = functions.https.onCall(async (data, context) => {
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
});
exports.getCloseFriction = functions.https.onCall(async (data, context) => {
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
});
exports.getVatSummary = functions.https.onCall(async (data, context) => {
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
});
exports.getMismatchSummary = functions.https.onCall(async (data, context) => {
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
});
exports.getAuditorReplay = functions.https.onCall(async (data, context) => {
    const user = await requireUser(context);
    if (!data.monthKey || !data.asOfDateKey) {
        throw new functions.https.HttpsError("invalid-argument", "monthKey and asOfDateKey are required");
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
});
exports.getExportArtifact = functions.https.onCall(async (data, context) => {
    const user = await requireUser(context);
    if (!data.monthKey || !data.artifactId) {
        throw new functions.https.HttpsError("invalid-argument", "monthKey and artifactId are required");
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
});
exports.getFlightRecorder = functions.https.onCall(async (data, context) => {
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
});
exports.approvePolicyProposal = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const user = await requireUser(context);
    if (!data.proposalId || !data.monthKey || !data.candidatePolicyVersion || !data.baselinePolicyVersion) {
        throw new functions.https.HttpsError("invalid-argument", "proposalId, monthKey, candidatePolicyVersion and baselinePolicyVersion are required");
    }
    if (!(user.role === "OWNER" || user.role === "MANAGER")) {
        throw new functions.https.HttpsError("permission-denied", "Only OWNER or MANAGER can approve policy proposals");
    }
    const result = await (0, zerebroxControlPlane_workflow_1.approveZerebroxPolicyProposalWorkflow)(db, {
        tenantId: user.tenantId,
        proposalId: data.proposalId,
        actorId: user.uid,
        now: admin.firestore.Timestamp.now(),
        candidatePolicyVersion: data.candidatePolicyVersion,
        baselinePolicyVersion: data.baselinePolicyVersion,
        regressionPrecisionDelta: (_a = data.regressionPrecisionDelta) !== null && _a !== void 0 ? _a : 0,
        regressionRecallDelta: (_b = data.regressionRecallDelta) !== null && _b !== void 0 ? _b : 0,
    });
    return result;
});
exports.controlPlaneHeartbeatHourly = functions.pubsub
    .schedule("every 60 minutes")
    .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());
    for (const tenant of tenantSnapshots.docs) {
        await (0, zerebroxControlPlane_workflow_1.runZerebroxControlPlaneHeartbeatWorkflow)(db, {
            tenantId: tenant.id,
            monthKey,
            now,
            actorId: "system",
            tier: "nightly",
        });
    }
    return null;
});
exports.controlPlaneAdaptationNightly = functions.pubsub
    .schedule("every day 02:00")
    .timeZone("UTC")
    .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());
    for (const tenant of tenantSnapshots.docs) {
        await (0, zerebroxControlPlane_workflow_1.runZerebroxControlPlaneHeartbeatWorkflow)(db, {
            tenantId: tenant.id,
            monthKey,
            now,
            actorId: "system",
            tier: "nightly",
        });
    }
    return null;
});
exports.controlPlaneAdaptationWeekly = functions.pubsub
    .schedule("every sunday 03:00")
    .timeZone("UTC")
    .onRun(async () => {
    const tenantSnapshots = await db.collection("tenants").get();
    const now = admin.firestore.Timestamp.now();
    const monthKey = monthKeyFromDate(now.toDate());
    for (const tenant of tenantSnapshots.docs) {
        await (0, zerebroxControlPlane_workflow_1.runZerebroxControlPlaneHeartbeatWorkflow)(db, {
            tenantId: tenant.id,
            monthKey,
            now,
            actorId: "system",
            tier: "weekly",
        });
    }
    return null;
});
//# sourceMappingURL=index.js.map