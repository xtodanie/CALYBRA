import { FieldValue, getFirestore } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";

// ========================================================================
// STATUS MACHINES (duplicated from src/domain/statusMachines for isolation)
// ========================================================================

enum MonthCloseStatus {
  DRAFT = "DRAFT",
  IN_REVIEW = "IN_REVIEW",
  FINALIZED = "FINALIZED",
}

const MONTH_CLOSE_TRANSITIONS: Record<MonthCloseStatus, readonly MonthCloseStatus[]> = {
  [MonthCloseStatus.DRAFT]: [MonthCloseStatus.IN_REVIEW],
  [MonthCloseStatus.IN_REVIEW]: [MonthCloseStatus.DRAFT, MonthCloseStatus.FINALIZED],
  [MonthCloseStatus.FINALIZED]: [],
};

enum MatchStatus {
  PROPOSED = "PROPOSED",
  CONFIRMED = "CONFIRMED",
  REJECTED = "REJECTED",
}

const MATCH_TRANSITIONS: Record<MatchStatus, readonly MatchStatus[]> = {
  [MatchStatus.PROPOSED]: [MatchStatus.CONFIRMED, MatchStatus.REJECTED],
  [MatchStatus.CONFIRMED]: [],
  [MatchStatus.REJECTED]: [],
};

// ========================================================================
// ROLES & PERMISSIONS (duplicated for isolation)
// ========================================================================

enum UserRole {
  OWNER = "OWNER",
  MANAGER = "MANAGER",
  ACCOUNTANT = "ACCOUNTANT",
  VIEWER = "VIEWER",
}

enum Permission {
  MONTH_CLOSE_TRANSITION = "MONTH_CLOSE_TRANSITION",
  MONTH_CLOSE_FINALIZE = "MONTH_CLOSE_FINALIZE",
  MATCH_CONFIRM = "MATCH_CONFIRM",
  MATCH_REJECT = "MATCH_REJECT",
}

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.VIEWER]: [],
  [UserRole.ACCOUNTANT]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
  ],
  [UserRole.MANAGER]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
  ],
  [UserRole.OWNER]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MONTH_CLOSE_FINALIZE,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
  ],
};

function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// ========================================================================
// HELPER: Load user and assert tenant + permission
// ========================================================================

interface UserProfile {
  uid: string;
  tenantId: string;
  role: UserRole;
}

async function loadAndAuthorize(
  uid: string,
  requiredPermission: Permission
): Promise<UserProfile> {
  const db = getFirestore();
  const userSnap = await db.collection("users").doc(uid).get();

  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "User profile not found.");
  }

  const userData = userSnap.data()!;
  const role = userData.role as UserRole;

  if (!hasPermission(role, requiredPermission)) {
    throw new functions.https.HttpsError(
      "permission-denied",
      `Role ${role} lacks permission ${requiredPermission}.`
    );
  }

  return {
    uid,
    tenantId: userData.tenantId as string,
    role,
  };
}

// ========================================================================
// transitionMonthClose
// ========================================================================

interface TransitionMonthCloseInput {
  monthCloseId: string;
  toStatus: string;
}

export const transitionMonthClose = functions.https.onCall(
  async (data: TransitionMonthCloseInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const { monthCloseId, toStatus } = data;
    if (!monthCloseId || !toStatus) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "monthCloseId and toStatus are required."
      );
    }

    // Validate toStatus is a valid MonthCloseStatus
    if (!Object.values(MonthCloseStatus).includes(toStatus as MonthCloseStatus)) {
      throw new functions.https.HttpsError("invalid-argument", `Invalid status: ${toStatus}`);
    }

    const targetStatus = toStatus as MonthCloseStatus;

    // Determine required permission
    const requiredPermission =
      targetStatus === MonthCloseStatus.FINALIZED
        ? Permission.MONTH_CLOSE_FINALIZE
        : Permission.MONTH_CLOSE_TRANSITION;

    const user = await loadAndAuthorize(context.auth.uid, requiredPermission);

    const db = getFirestore();
    const monthCloseRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("monthCloses")
      .doc(monthCloseId);

    const monthCloseSnap = await monthCloseRef.get();
    if (!monthCloseSnap.exists) {
      throw new functions.https.HttpsError("not-found", "MonthClose not found.");
    }

    const monthCloseData = monthCloseSnap.data()!;

    // Assert tenant match
    if (monthCloseData.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    const currentStatus = monthCloseData.status as MonthCloseStatus;

    // Assert legal transition
    const allowedTransitions = MONTH_CLOSE_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Illegal transition: ${currentStatus} -> ${targetStatus}`
      );
    }

    // Write via Admin SDK
    const updatePayload: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
    };

    if (targetStatus === MonthCloseStatus.FINALIZED) {
      updatePayload.finalizedAt = FieldValue.serverTimestamp();
      updatePayload.finalizedBy = user.uid;
    }

    await monthCloseRef.update(updatePayload);

    return { success: true, status: targetStatus };
  }
);

// ========================================================================
// transitionMatch
// ========================================================================

interface TransitionMatchInput {
  matchId: string;
  toStatus: string;
}

export const transitionMatch = functions.https.onCall(
  async (data: TransitionMatchInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const { matchId, toStatus } = data;
    if (!matchId || !toStatus) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "matchId and toStatus are required."
      );
    }

    // Validate toStatus is a valid MatchStatus
    if (!Object.values(MatchStatus).includes(toStatus as MatchStatus)) {
      throw new functions.https.HttpsError("invalid-argument", `Invalid status: ${toStatus}`);
    }

    const targetStatus = toStatus as MatchStatus;

    // Determine required permission
    const requiredPermission =
      targetStatus === MatchStatus.CONFIRMED
        ? Permission.MATCH_CONFIRM
        : Permission.MATCH_REJECT;

    const user = await loadAndAuthorize(context.auth.uid, requiredPermission);

    const db = getFirestore();

    // Find the match - we need to know the tenantId to locate it
    // Matches are stored under /tenants/{tenantId}/matches/{matchId}
    const matchRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("matches")
      .doc(matchId);

    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Match not found.");
    }

    const matchData = matchSnap.data()!;

    // Assert tenant match
    if (matchData.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError("permission-denied", "Tenant mismatch.");
    }

    const currentStatus = matchData.status as MatchStatus;

    // Assert legal transition
    const allowedTransitions = MATCH_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Illegal transition: ${currentStatus} -> ${targetStatus}`
      );
    }

    // Write via Admin SDK
    await matchRef.update({
      status: targetStatus,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: user.uid,
      resolvedAt: FieldValue.serverTimestamp(),
      resolvedBy: user.uid,
    });

    return { success: true, status: targetStatus };
  }
);
