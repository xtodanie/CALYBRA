/**
 * Mismatch Summary - read model
 * Pure projection logic. No IO, no randomness, no time.
 */

import { MismatchSummary } from "../logic/accounting/mismatchDetector";

export interface MismatchSummaryReadModel {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly bankTxWithoutInvoice: readonly string[];
  readonly invoiceMatchedWithoutBankTx: readonly string[];
  readonly partialPayments: readonly string[];
  readonly overpayments: readonly string[];
  readonly generatedAt: string; // ISO timestamp
  readonly periodLockHash: string;
  readonly schemaVersion: 1;
}

export function buildMismatchSummaryReadModel(input: {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly summary: MismatchSummary;
  readonly generatedAt: string;
  readonly periodLockHash: string;
}): MismatchSummaryReadModel {
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    bankTxWithoutInvoice: [...input.summary.bankTxWithoutInvoice],
    invoiceMatchedWithoutBankTx: [...input.summary.invoiceMatchedWithoutBankTx],
    partialPayments: [...input.summary.partialPayments],
    overpayments: [...input.summary.overpayments],
    generatedAt: input.generatedAt,
    periodLockHash: input.periodLockHash,
    schemaVersion: 1,
  };
}
