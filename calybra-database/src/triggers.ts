/**
 * Firestore Triggers for Accounting Integrity
 *
 * These triggers enforce immutable snapshots and event sourcing patterns.
 */

import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

// ========================================================================
// TYPES
// ========================================================================

interface MonthCloseDocument {
  id: string;
  tenantId: string;
  status: string;
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  matchCount: number;
  openExceptionsCount: number;
  highExceptionsCount: number;
  finalizedAt?: FirebaseFirestore.Timestamp;
  finalizedBy?: string;
}

interface ReadmodelSnapshot {
  id: string;
  tenantId: string;
  monthCloseId: string;
  status: "FINALIZED";

  // Summary totals (immutable after creation)
  bankTotal: number;
  invoiceTotal: number;
  diff: number;
  matchCount: number;
  exceptionCount: number;
  openExceptionCount: number;
  highExceptionCount: number;

  // Finalization metadata
  finalizedAt: FirebaseFirestore.FieldValue;
  finalizedBy: string;

  // Denormalized counts for export
  invoiceCount: number;
  bankTxCount: number;

  // Immutability marker
  isImmutable: true;
  schemaVersion: number;
  createdAt: FirebaseFirestore.FieldValue;
}

// ========================================================================
// TRIGGER: onMonthCloseFinalized
// ========================================================================

/**
 * Triggered when a monthClose document is updated.
 * If status transitions TO FINALIZED, generates an immutable readmodel snapshot.
 *
 * This snapshot is used for exports and guarantees:
 * 1. No recomputation after freeze
 * 2. Exports always produce identical output
 * 3. Live collection changes do not affect historical reports
 */
export const onMonthCloseFinalized = onDocumentUpdated(
  "tenants/{tenantId}/monthCloses/{monthCloseId}",
  async (event) => {
    try {
      const { tenantId, monthCloseId } = event.params;
      const before = event.data?.before.data() as MonthCloseDocument | undefined;
      const after = event.data?.after.data() as MonthCloseDocument | undefined;

      if (!before || !after) {
        console.log("No data in event, skipping");
        return;
      }

      // Only trigger when transitioning TO FINALIZED
      if (before.status === "FINALIZED" || after.status !== "FINALIZED") {
        return;
      }

      console.log(
        `MonthClose ${monthCloseId} finalized for tenant ${tenantId}. Generating readmodel snapshot.`
      );

      const db = getFirestore();

      // Check if snapshot already exists (idempotency)
      const snapshotRef = db
        .collection("tenants")
        .doc(tenantId)
        .collection("readmodels")
        .doc(monthCloseId);

      const existingSnapshot = await snapshotRef.get();
      if (existingSnapshot.exists) {
        console.warn(
          `Readmodel snapshot ${monthCloseId} already exists. Skipping creation.`
        );
        return;
      }

      // Gather all data for the snapshot
      const [invoicesSnap, bankTxSnap, matchesSnap, exceptionsSnap] = await Promise.all([
        db
          .collection("tenants")
          .doc(tenantId)
          .collection("invoices")
          .where("monthCloseId", "==", monthCloseId)
          .get(),
        db
          .collection("tenants")
          .doc(tenantId)
          .collection("bankTx")
          .where("monthCloseId", "==", monthCloseId)
          .get(),
        db
          .collection("tenants")
          .doc(tenantId)
          .collection("matches")
          .where("monthCloseId", "==", monthCloseId)
          .get(),
        db
          .collection("exceptions")
          .where("tenantId", "==", tenantId)
          .where("monthCloseId", "==", monthCloseId)
          .get(),
      ]);

      // Count matches by status
      let confirmedMatchCount = 0;
      matchesSnap.forEach((doc) => {
        const data = doc.data();
        if (data.status === "CONFIRMED") {
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
        if (data.status === "OPEN") {
          openExceptionCount++;
        }
        if (data.severity === "HIGH") {
          highExceptionCount++;
        }
      });

      // Create the immutable snapshot
      const snapshot: ReadmodelSnapshot = {
        id: monthCloseId,
        tenantId,
        monthCloseId,
        status: "FINALIZED",

        // Summary totals from monthClose
        bankTotal: after.bankTotal || 0,
        invoiceTotal: after.invoiceTotal || 0,
        diff: after.diff || 0,
        matchCount: confirmedMatchCount,
        exceptionCount: totalExceptionCount,
        openExceptionCount,
        highExceptionCount,

        // Finalization metadata
        finalizedAt: FieldValue.serverTimestamp(),
        finalizedBy: after.finalizedBy || "system",

        // Denormalized counts
        invoiceCount: invoicesSnap.size,
        bankTxCount: bankTxSnap.size,

        // Immutability marker
        isImmutable: true,
        schemaVersion: 1,
        createdAt: FieldValue.serverTimestamp(),
      };

      await snapshotRef.set(snapshot);

      console.log(
        `Readmodel snapshot created for ${monthCloseId}: ` +
        `${invoicesSnap.size} invoices, ${bankTxSnap.size} bankTx, ` +
        `${confirmedMatchCount} confirmed matches, ${totalExceptionCount} exceptions`
      );
    } catch (error) {
      console.error("onMonthCloseFinalized error:", error);
      throw error;
    }
  }
);
