/**
 * Read-Only API Callables — SSI-0307
 * Exposes read-only readmodel data to authorized tenant members.
 * No writes. Authorization at boundary. Pure read projections.
 */

import { getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

// ========================================================================
// HELPER: Load user and assert tenant membership
// ========================================================================

interface UserProfile {
  uid: string;
  tenantId: string;
  role: string;
}

async function loadUser(uid: string): Promise<UserProfile> {
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }
  const data = userSnap.data() as { tenantId: string; role: string };
  return { uid, tenantId: data.tenantId, role: data.role };
}

function assertAuth(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Must be authenticated."
    );
  }
  return context.auth.uid;
}

function validateMonthKey(monthKey: unknown): string {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "monthKey must be YYYY-MM format."
    );
  }
  return monthKey;
}

// ========================================================================
// getVatSummary — returns VAT summary read model for a month
// ========================================================================

export const getVatSummary = functions.https.onCall(
  async (
    data: { monthKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/readmodels/vatSummary/${monthKey}/snapshot`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// getMismatchSummary — returns mismatch summary read model for a month
// ========================================================================

export const getMismatchSummary = functions.https.onCall(
  async (
    data: { monthKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/readmodels/mismatchSummary/${monthKey}/snapshot`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// getMonthCloseTimeline — returns timeline read model for a month
// ========================================================================

export const getMonthCloseTimeline = functions.https.onCall(
  async (
    data: { monthKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/readmodels/monthCloseTimeline/${monthKey}/snapshot`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// getCloseFriction — returns close friction metrics for a month
// ========================================================================

export const getCloseFriction = functions.https.onCall(
  async (
    data: { monthKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/readmodels/closeFriction/${monthKey}/snapshot`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// getAuditorReplay — returns auditor replay snapshot for a month+asOfDate
// ========================================================================

export const getAuditorReplay = functions.https.onCall(
  async (
    data: { monthKey?: string; asOfDateKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const asOfDateKey = data?.asOfDateKey;
    if (typeof asOfDateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDateKey)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "asOfDateKey must be YYYY-MM-DD format."
      );
    }

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/readmodels/auditorReplay/${monthKey}/${asOfDateKey}`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// getExportArtifact — returns a generated export (CSV/PDF) for a month
// ========================================================================

export const getExportArtifact = functions.https.onCall(
  async (
    data: { monthKey?: string; artifactId?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const artifactId = data?.artifactId;
    if (typeof artifactId !== "string" || artifactId.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "artifactId is required."
      );
    }

    const db = getFirestore();
    const snap = await db
      .doc(`tenants/${user.tenantId}/exports/${monthKey}/artifacts/${artifactId}`)
      .get();

    if (!snap.exists) {
      return { exists: false, data: null };
    }

    const result = snap.data();
    if (result?.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    return { exists: true, data: result };
  }
);

// ========================================================================
// listExportArtifacts — lists all exports for a month
// ========================================================================

export const listExportArtifacts = functions.https.onCall(
  async (
    data: { monthKey?: string },
    context: functions.https.CallableContext
  ) => {
    const uid = assertAuth(context);
    const user = await loadUser(uid);
    const monthKey = validateMonthKey(data?.monthKey);

    const db = getFirestore();
    const snaps = await db
      .collection(`tenants/${user.tenantId}/exports/${monthKey}/artifacts`)
      .get();

    const artifacts = snaps.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return { artifacts };
  }
);
