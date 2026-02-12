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

enum ExceptionStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
  IGNORED = "IGNORED",
}

const EXCEPTION_TRANSITIONS: Record<ExceptionStatus, readonly ExceptionStatus[]> = {
  [ExceptionStatus.OPEN]: [ExceptionStatus.RESOLVED, ExceptionStatus.IGNORED],
  [ExceptionStatus.RESOLVED]: [],
  [ExceptionStatus.IGNORED]: [],
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
  EXCEPTION_RESOLVE = "EXCEPTION_RESOLVE",
}

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.VIEWER]: [],
  [UserRole.ACCOUNTANT]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.EXCEPTION_RESOLVE,
  ],
  [UserRole.MANAGER]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.EXCEPTION_RESOLVE,
  ],
  [UserRole.OWNER]: [
    Permission.MONTH_CLOSE_TRANSITION,
    Permission.MONTH_CLOSE_FINALIZE,
    Permission.MATCH_CONFIRM,
    Permission.MATCH_REJECT,
    Permission.EXCEPTION_RESOLVE,
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

    // ========================================
    // FINALIZATION GATE: No OPEN exceptions allowed
    // ========================================
    if (targetStatus === MonthCloseStatus.FINALIZED) {
      const openExceptionsSnap = await db
        .collection("exceptions")
        .where("tenantId", "==", user.tenantId)
        .where("monthCloseId", "==", monthCloseId)
        .where("status", "==", ExceptionStatus.OPEN)
        .get();

      if (!openExceptionsSnap.empty) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Cannot finalize: ${openExceptionsSnap.size} OPEN exception(s) remain. All exceptions must be resolved or ignored before finalization.`
        );
      }
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

    // ========================================
    // FINALIZATION: Create immutable readmodel snapshot
    // ========================================
    if (targetStatus === MonthCloseStatus.FINALIZED) {
      const snapshotRef = db
        .collection("tenants")
        .doc(user.tenantId)
        .collection("readmodels")
        .doc(monthCloseId);

      // Check idempotency - don't overwrite if exists
      const existingSnapshot = await snapshotRef.get();
      if (!existingSnapshot.exists) {
        // Gather all data for the snapshot
        const [invoicesSnap, bankTxSnap, matchesSnap, exceptionsSnap] = await Promise.all([
          db.collection("tenants").doc(user.tenantId).collection("invoices")
            .where("monthCloseId", "==", monthCloseId).get(),
          db.collection("tenants").doc(user.tenantId).collection("bankTx")
            .where("monthCloseId", "==", monthCloseId).get(),
          db.collection("tenants").doc(user.tenantId).collection("matches")
            .where("monthCloseId", "==", monthCloseId).get(),
          db.collection("exceptions")
            .where("tenantId", "==", user.tenantId)
            .where("monthCloseId", "==", monthCloseId).get(),
        ]);

        // Count confirmed matches
        let confirmedMatchCount = 0;
        matchesSnap.forEach((doc) => {
          if (doc.data().status === MatchStatus.CONFIRMED) {
            confirmedMatchCount++;
          }
        });

        // Count exceptions by status and severity
        let totalExceptionCount = 0;
        let openExceptionCount = 0;
        let highExceptionCount = 0;
        exceptionsSnap.forEach((doc) => {
          totalExceptionCount++;
          const data = doc.data();
          if (data.status === ExceptionStatus.OPEN) openExceptionCount++;
          if (data.severity === "HIGH") highExceptionCount++;
        });

        // Create the immutable snapshot
        await snapshotRef.set({
          id: monthCloseId,
          tenantId: user.tenantId,
          monthCloseId,
          status: "FINALIZED",
          bankTotal: monthCloseData.bankTotal || 0,
          invoiceTotal: monthCloseData.invoiceTotal || 0,
          diff: monthCloseData.diff || 0,
          matchCount: confirmedMatchCount,
          exceptionCount: totalExceptionCount,
          openExceptionCount,
          highExceptionCount,
          finalizedAt: FieldValue.serverTimestamp(),
          finalizedBy: user.uid,
          invoiceCount: invoicesSnap.size,
          bankTxCount: bankTxSnap.size,
          isImmutable: true,
          schemaVersion: 1,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

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

    // ========================================
    // CRITICAL: Block mutations after FINALIZED
    // ========================================
    const monthCloseId = matchData.monthCloseId as string;
    const monthCloseRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("monthCloses")
      .doc(monthCloseId);

    const monthCloseSnap = await monthCloseRef.get();
    if (monthCloseSnap.exists) {
      const monthCloseData = monthCloseSnap.data()!;
      if (monthCloseData.status === MonthCloseStatus.FINALIZED) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot modify matches after month close is FINALIZED."
        );
      }
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

    // ========================================
    // RECOMPUTE: Update monthClose summary after transition
    // matchCount reflects CONFIRMED matches only
    // ========================================
    await recomputeMonthCloseSummary(db, user.tenantId, monthCloseId);

    return { success: true, status: targetStatus };
  }
);

// ========================================================================
// HELPER: Recompute MonthClose Summary
// ========================================================================

async function recomputeMonthCloseSummary(
  db: FirebaseFirestore.Firestore,
  tenantId: string,
  monthCloseId: string
): Promise<void> {
  const monthCloseRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("monthCloses")
    .doc(monthCloseId);

  // Use transaction to ensure atomic read-modify-write
  await db.runTransaction(async (tx) => {
    const monthCloseSnap = await tx.get(monthCloseRef);
    if (!monthCloseSnap.exists) {
      throw new Error(`MonthClose ${monthCloseId} not found`);
    }

    // Query all data for this month close
    const [bankTxSnap, invoicesSnap, matchesSnap, exceptionsSnap] = await Promise.all([
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("bankTx")
        .where("monthCloseId", "==", monthCloseId)
        .get(),
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("invoices")
        .where("monthCloseId", "==", monthCloseId)
        .get(),
      db
        .collection("tenants")
        .doc(tenantId)
        .collection("matches")
        .where("monthCloseId", "==", monthCloseId)
        .where("status", "==", MatchStatus.CONFIRMED) // Only count CONFIRMED matches
        .get(),
      db
        .collection("exceptions")
        .where("tenantId", "==", tenantId)
        .where("monthCloseId", "==", monthCloseId)
        .where("status", "==", "OPEN")
        .get(),
    ]);

    // Calculate totals
    let bankTotal = 0;
    bankTxSnap.forEach((doc) => {
      bankTotal += doc.data().amount || 0;
    });

    let invoiceTotal = 0;
    invoicesSnap.forEach((doc) => {
      invoiceTotal += doc.data().totalGross || 0;
    });

    const matchCount = matchesSnap.size;
    const openExceptionsCount = exceptionsSnap.size;
    const highExceptionsCount = exceptionsSnap.docs.filter(
      (d) => d.data().severity === "HIGH"
    ).length;

    const diff = bankTotal - invoiceTotal;

    // Update month close document atomically
    tx.update(monthCloseRef, {
      bankTotal,
      invoiceTotal,
      diff,
      matchCount,
      openExceptionsCount,
      highExceptionsCount,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "system",
    });
  });
}

// ========================================================================
// HELPER: Generate Deterministic ID (same as ingestion)
// ========================================================================

import * as crypto from "crypto";

function generateDeterministicId(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 20);
}

// ========================================================================
// resolveException
// ========================================================================

/**
 * Resolution action types for exceptions.
 *
 * RESOLVE_WITH_MATCH: Links a bankTx to an invoice, creating a CONFIRMED match.
 * MARK_AS_EXPENSE: Marks the bankTx as a non-invoice expense.
 * IGNORE: Ignores the exception with a reason (soft resolve).
 */
type ExceptionResolutionAction =
  | { type: "RESOLVE_WITH_MATCH"; linkToInvoiceId: string }
  | { type: "MARK_AS_EXPENSE" }
  | { type: "IGNORE"; reason: string };

interface ResolveExceptionInput {
  exceptionId: string;
  action: ExceptionResolutionAction;
}

export const resolveException = functions.https.onCall(
  async (data: ResolveExceptionInput, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const { exceptionId, action } = data;
    if (!exceptionId || !action) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "exceptionId and action are required."
      );
    }

    // Validate action type
    const validActions = ["RESOLVE_WITH_MATCH", "MARK_AS_EXPENSE", "IGNORE"];
    if (!validActions.includes(action.type)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid action type: ${action.type}`
      );
    }

    const user = await loadAndAuthorize(context.auth.uid, Permission.EXCEPTION_RESOLVE);

    const db = getFirestore();

    // ========================================
    // Fetch the exception
    // ========================================
    const exceptionRef = db.collection("exceptions").doc(exceptionId);
    const exceptionSnap = await exceptionRef.get();

    if (!exceptionSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Exception not found.");
    }

    const exceptionData = exceptionSnap.data()!;

    // ========================================
    // Security: Assert tenant match
    // ========================================
    if (exceptionData.tenantId !== user.tenantId) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Exception does not belong to your tenant."
      );
    }

    // ========================================
    // CRITICAL: Block mutations after FINALIZED
    // ========================================
    const monthCloseId = exceptionData.monthCloseId as string;
    const monthCloseRef = db
      .collection("tenants")
      .doc(user.tenantId)
      .collection("monthCloses")
      .doc(monthCloseId);

    const monthCloseSnap = await monthCloseRef.get();
    if (monthCloseSnap.exists) {
      const monthCloseData = monthCloseSnap.data()!;
      if (monthCloseData.status === MonthCloseStatus.FINALIZED) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Cannot resolve exceptions after month close is FINALIZED."
        );
      }
    }

    // ========================================
    // Assert exception is in OPEN state
    // ========================================
    const currentStatus = exceptionData.status as ExceptionStatus;
    if (currentStatus !== ExceptionStatus.OPEN) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Exception is not OPEN. Current status: ${currentStatus}`
      );
    }

    // ========================================
    // Determine target status based on action
    // ========================================
    const targetStatus =
      action.type === "IGNORE" ? ExceptionStatus.IGNORED : ExceptionStatus.RESOLVED;

    // Validate transition
    const allowedTransitions = EXCEPTION_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(targetStatus)) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Illegal transition: ${currentStatus} -> ${targetStatus}`
      );
    }

    // ========================================
    // Execute resolution in transaction
    // ========================================
    await db.runTransaction(async (tx) => {
      // Re-read exception to check for concurrent modifications
      const txExceptionSnap = await tx.get(exceptionRef);
      if (!txExceptionSnap.exists) {
        throw new Error("Exception deleted during transaction");
      }

      const txExceptionData = txExceptionSnap.data()!;
      if (txExceptionData.status !== ExceptionStatus.OPEN) {
        throw new Error("Exception status changed during transaction");
      }

      // Prepare resolution data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resolutionPayload: Record<string, any> = {
        status: targetStatus,
        resolvedAt: FieldValue.serverTimestamp(),
        resolvedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: user.uid,
        resolutionAction: action.type,
      };

      if (action.type === "IGNORE" && "reason" in action) {
        resolutionPayload.ignoreReason = action.reason;
      }

      // ========================================
      // Handle RESOLVE_WITH_MATCH: Create a confirmed match
      // ========================================
      if (action.type === "RESOLVE_WITH_MATCH" && "linkToInvoiceId" in action) {
        const refId = txExceptionData.refId as string;

        // Only BANK_NO_INVOICE exceptions can be resolved with a match
        if (txExceptionData.kind !== "BANK_NO_INVOICE") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Only BANK_NO_INVOICE exceptions can be resolved with a match."
          );
        }

        // Validate the linked invoice exists
        const invoiceRef = db
          .collection("tenants")
          .doc(user.tenantId)
          .collection("invoices")
          .doc(action.linkToInvoiceId);

        const invoiceSnap = await tx.get(invoiceRef);
        if (!invoiceSnap.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            `Invoice ${action.linkToInvoiceId} not found.`
          );
        }

        const invoiceData = invoiceSnap.data()!;
        if (invoiceData.monthCloseId !== monthCloseId) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Invoice belongs to a different month close."
          );
        }

        // Create deterministic match ID
        const matchIdContent = `${user.tenantId}:manual-match:${refId}:${action.linkToInvoiceId}`;
        const matchDocId = generateDeterministicId(matchIdContent);
        const matchRef = db
          .collection("tenants")
          .doc(user.tenantId)
          .collection("matches")
          .doc(matchDocId);

        // Check if match already exists (idempotency)
        const existingMatchSnap = await tx.get(matchRef);
        if (!existingMatchSnap.exists) {
          // Create new confirmed match
          tx.set(matchRef, {
            id: matchDocId,
            tenantId: user.tenantId,
            monthCloseId,
            bankTxIds: [refId],
            invoiceIds: [action.linkToInvoiceId],
            matchType: "MANUAL",
            score: 100,
            status: MatchStatus.CONFIRMED,
            explanationKey: "matches.manualResolution",
            explanationParams: { resolvedBy: user.uid },
            confirmedBy: user.uid,
            confirmedAt: FieldValue.serverTimestamp(),
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: user.uid,
            updatedBy: user.uid,
            schemaVersion: 1,
          });
        }

        resolutionPayload.linkedMatchId = matchDocId;
      }

      // Update the exception
      tx.update(exceptionRef, resolutionPayload);
    });

    // ========================================
    // RECOMPUTE: Update monthClose summary after resolution
    // ========================================
    await recomputeMonthCloseSummary(db, user.tenantId, monthCloseId);

    return {
      success: true,
      status: targetStatus,
      exceptionId,
    };
  }
);
