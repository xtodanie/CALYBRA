/**
 * Firestore Invoice Abstraction
 *
 * Read-only subscription layer for invoices.
 * Path: tenants/{tenantId}/invoices
 *
 * INVARIANTS:
 * - Tenant-scoped queries only
 * - Month-scoped filters required
 * - No client writes - read-only
 * - Live snapshot subscription
 */

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  type Query,
  type DocumentData,
  type Unsubscribe,
  type FirestoreError,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import type { Invoice } from '@/lib/types';

export interface InvoiceSubscriptionOptions {
  tenantId: string;
  monthCloseId: string;
  onData: (invoices: Invoice[]) => void;
  onError: (error: FirestoreError) => void;
}

/**
 * Creates a Firestore query for invoices within a tenant and month.
 *
 * Query path: tenants/{tenantId}/invoices
 * Constraints:
 *   - where("monthCloseId", "==", activeMonthCloseId)
 *   - orderBy("issueDate", "desc")
 */
export function buildInvoicesQuery(
  tenantId: string,
  monthCloseId: string
): Query<DocumentData> {
  return query(
    collection(db, 'tenants', tenantId, 'invoices'),
    where('monthCloseId', '==', monthCloseId),
    orderBy('issueDate', 'desc')
  );
}

/**
 * Subscribes to real-time invoice updates for a specific tenant and month.
 *
 * Returns an unsubscribe function for cleanup.
 *
 * Usage:
 * ```
 * const unsubscribe = subscribeToInvoices({
 *   tenantId: user.tenantId,
 *   monthCloseId: user.activeMonthCloseId,
 *   onData: (invoices) => setInvoices(invoices),
 *   onError: (err) => setError(err.message),
 * });
 *
 * // Cleanup on unmount or month change
 * return () => unsubscribe();
 * ```
 */
export function subscribeToInvoices({
  tenantId,
  monthCloseId,
  onData,
  onError,
}: InvoiceSubscriptionOptions): Unsubscribe {
  const invoicesQuery = buildInvoicesQuery(tenantId, monthCloseId);

  return onSnapshot(
    invoicesQuery,
    (snapshot) => {
      const invoices: Invoice[] = [];
      snapshot.forEach((doc) => {
        invoices.push({ id: doc.id, ...doc.data() } as Invoice);
      });
      onData(invoices);
    },
    (error) => {
      console.error('[InvoicesSubscription] Error:', error);
      onError(error);
    }
  );
}
