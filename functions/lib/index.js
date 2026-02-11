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
exports.getSignedDownloadUrl = exports.processJob = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const db = admin.firestore();
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
        const allowedRoles = ["OWNER", "MANAGER"];
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
//# sourceMappingURL=index.js.map