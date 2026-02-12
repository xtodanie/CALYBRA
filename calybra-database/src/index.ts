import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import * as functions from "firebase-functions/v1";
import { assertAllowedDownload, buildFileAssetDocPath, DownloadAuthError } from "./lib/download";

initializeApp();

// Re-export transition functions (server-authoritative status changes)
export { transitionMonthClose, transitionMatch, resolveException } from "./transitions";

// Re-export ingestion pipeline (server-authoritative job processing)
export { createJob, processJob, retryJob } from "./ingestion";

// Re-export read-only API callables (SSI-0307)
export {
  getVatSummary,
  getMismatchSummary,
  getMonthCloseTimeline,
  getCloseFriction,
  getAuditorReplay,
  getExportArtifact,
  listExportArtifacts,
} from "./readApis";

// Note: onMonthCloseFinalized trigger is currently disabled due to firebase-functions v7 compatibility issues
// The readmodel snapshot is created directly in transitionMonthClose instead
// export { onMonthCloseFinalized } from "./triggers";

export const onAuthCreate = functions.auth.user().onCreate(
  async (user: functions.auth.UserRecord): Promise<void> => {
    const db = getFirestore();

    // Use user.uid as the stable ID for the user document
    const userRef = db.collection("users").doc(user.uid);
    // Generate a new, unique ID for the tenant
    const tenantRef = db.collection("tenants").doc();

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      // Idempotency: if user doc already exists, do nothing.
      // This handles retries of the function.
      if (userSnap.exists) return;

      const now = FieldValue.serverTimestamp();

      tx.create(tenantRef, {
        tenantId: tenantRef.id,
        ownerId: user.uid,
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
      });

      tx.create(userRef, {
        uid: user.uid,
        tenantId: tenantRef.id,
        email: user.email ?? null,
        role: "OWNER",
        plan: "free",
        status: "active",
        locale: "es",
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        metadata: {
          source: "signup",
        },
      });
    });
  },
);

/**
 * Recovers missing tenant/user documents for an authenticated user.
 * Used when auth triggers are delayed or not running (e.g. local emulators).
 */
export const ensureUserProvisioned = functions.https.onCall(
  async (
    _data: unknown,
    context: functions.https.CallableContext
  ) => {
    const auth = context.auth;
    if (!auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "The function must be called while authenticated."
      );
    }

    const uid = auth.uid;
    const db = getFirestore();
    const userRef = db.collection("users").doc(uid);
    const tenantRef = db.collection("tenants").doc();
    const existingTenantRef = db.collection("tenants").doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) return;

      const now = FieldValue.serverTimestamp();
      const tenantSnap = await tx.get(existingTenantRef);
      const resolvedTenantRef = tenantSnap.exists ? existingTenantRef : tenantRef;
      if (!tenantSnap.exists) {
        tx.create(resolvedTenantRef, {
          tenantId: resolvedTenantRef.id,
          ownerId: uid,
          schemaVersion: 1,
          createdAt: now,
          updatedAt: now,
        });
      }
      tx.create(userRef, {
        uid,
        tenantId: resolvedTenantRef.id,
        email: auth.token.email ?? null,
        role: "OWNER",
        plan: "free",
        status: "active",
        locale: "es",
        schemaVersion: 1,
        createdAt: now,
        updatedAt: now,
        metadata: {
          source: "auto-recovery",
          recoveryCount: 1,
        },
      });
      return;
    });

    return { status: "ok" };
  }
);

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

    const { fileAssetId } = data || {};
    if (!fileAssetId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "The function must be called with a \"fileAssetId\" argument."
      );
    }

    const db = getFirestore();
    const uid = context.auth.uid;
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }

    const userData = userDoc.data() as { tenantId: string; role: string };
    const fileAssetPath = buildFileAssetDocPath(userData.tenantId, fileAssetId);
    const fileAssetDoc = await db.doc(fileAssetPath).get();

    if (!fileAssetDoc.exists) {
      throw new functions.https.HttpsError("not-found", "File not found.");
    }

    const fileAssetData = fileAssetDoc.data() as { tenantId?: string; storagePath?: string };
    try {
      assertAllowedDownload(userData, fileAssetData);
    } catch (err) {
      if (err instanceof DownloadAuthError) {
        throw new functions.https.HttpsError(err.code, err.message);
      }
      throw err;
    }

    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 15);

    const [url] = await getStorage()
      .bucket()
      .file(fileAssetData.storagePath as string)
      .getSignedUrl({
        action: "read",
        expires: expiryDate,
      });

    return { url, expiresAt: expiryDate.toISOString() };
  }
);
