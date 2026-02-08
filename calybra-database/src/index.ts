import {initializeApp} from "firebase-admin/app";
import {FieldValue, getFirestore} from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

initializeApp();

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
      });
    });
  }
);
