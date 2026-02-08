import { onUserCreated, AuthEvent } from "firebase-functions/v2/auth";
import * as admin from "firebase-admin";

/**
 * CALYBRA — AUTH INVARIANT ENFORCER (v2)
 *
 * Guarantees:
 * - Every Auth user gets a Firestore user profile
 * - Every user belongs to exactly one tenant
 * - Creation is atomic and backend-authoritative
 *
 * Clients NEVER create users or tenants.
 */

admin.initializeApp();

export const onAuthCreate = onUserCreated(async (event: AuthEvent) => {
  const user = event.data;
  if (!user) return;

  const db = admin.firestore();

  const userRef = db.collection("users").doc(user.uid);
  const tenantRef = db.collection("tenants").doc();
  const companyName = user.email ? `Company for ${user.email}` : `Tenant for ${user.uid}`;

  await db.runTransaction(async (tx) => {
    // Create tenant
    tx.set(tenantRef, {
      id: tenantRef.id,
      name: companyName,
      ownerId: user.uid,
      timezone: "UTC",
      currency: "EUR",
      schemaVersion: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Create user profile
    tx.set(userRef, {
      uid: user.uid,
      tenantId: tenantRef.id,
      email: user.email ?? null,
      role: "OWNER",
      plan: "free",
      status: "active",
      locale: "es",
      schemaVersion: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: {
        source: "signup",
      },
    });
  });
});
