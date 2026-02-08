import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

/**
 * This function triggers when a new user is created in Firebase Authentication.
 * It atomically creates a new `tenant` and a corresponding `user` document
 * in Firestore, ensuring data integrity from the very beginning.
 * This is the primary mechanism for user profile creation.
 */
export const onAuthCreate = functions.auth.user().onCreate(
  async (user) => {
    const { uid, email } = user;
    const batch = db.batch();
    const schemaVersion = 1;

    // 1. Create a new tenant document for this user.
    const tenantDocRef = db.collection("tenants").doc();
    const companyName = email ? `Company for ${email}` : `Tenant for ${uid}`;
    batch.set(tenantDocRef, {
      name: companyName,
      ownerId: uid,
      timezone: "UTC", // Default, user can change later.
      currency: "EUR",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      schemaVersion,
    });

    // 2. Create the canonical user document.
    const userDocRef = db.doc(`users/${uid}`);
    batch.set(userDocRef, {
      uid,
      email: email ?? null,
      tenantId: tenantDocRef.id,
      role: "OWNER",
      plan: "free",
      status: "active",
      locale: "es", // Default locale
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      schemaVersion,
      metadata: {
        source: "signup",
      },
    });
    
    // 3. Commit the batch.
    try {
        await batch.commit();
        console.log(`Successfully created tenant and user profile for UID: ${uid}`);
    } catch (error) {
        console.error(`Failed to create tenant/user for UID: ${uid}`, error);
    }
});


/**
 * Simulates a job process by updating the job document in Firestore through several steps.
 * This is triggered whenever a new document is created in the 'jobs' collection.
 */
export const processJob = functions.firestore
  .document("jobs/{jobId}")
  .onCreate(async (snap, context) => {
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
  async (data, context) => {
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
      const fileAssetRef = db.collection("fileAssets").doc(fileAssetId);

      const [userDoc, fileAssetDoc] = await Promise.all([
        userDocRef.get(),
        fileAssetRef.get(),
      ]);

      if (!userDoc.exists) {
        throw new functions.https.HttpsError("not-found", "User not found.");
      }
      if (!fileAssetDoc.exists) {
        throw new functions.https.HttpsError("not-found", "File not found.");
      }

      const userData = userDoc.data()!;
      const fileAssetData = fileAssetDoc.data()!;

      const allowedRoles = ["OWNER", "MANAGER"];
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
