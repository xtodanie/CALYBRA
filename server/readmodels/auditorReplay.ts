/**
 * Auditor Replay - read model snapshot
 * Pure projection logic. No IO, no randomness, no time.
 */

import {
  BankTxSnapshot,
  InvoiceSnapshot,
  MatchSnapshot,
  AdjustmentSnapshot,
} from "../logic/counterfactual/ledgerSnapshot";

export interface AuditorReplaySnapshot {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly asOfDateKey: string; // YYYY-MM-DD
  readonly bankTx: readonly BankTxSnapshot[];
  readonly invoices: readonly InvoiceSnapshot[];
  readonly matches: readonly MatchSnapshot[];
  readonly adjustments: readonly AdjustmentSnapshot[];
  readonly generatedAt: string; // ISO timestamp
  readonly periodLockHash: string;
  readonly schemaVersion: 1;
}

export function buildAuditorReplaySnapshot(input: {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly asOfDateKey: string;
  readonly bankTx: readonly BankTxSnapshot[];
  readonly invoices: readonly InvoiceSnapshot[];
  readonly matches: readonly MatchSnapshot[];
  readonly adjustments: readonly AdjustmentSnapshot[];
  readonly generatedAt: string;
  readonly periodLockHash: string;
}): AuditorReplaySnapshot {
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    asOfDateKey: input.asOfDateKey,
    bankTx: [...input.bankTx].sort((a, b) => {
      const dateCompare = (a.bookingDate ?? "").localeCompare(b.bookingDate ?? "");
      if (dateCompare !== 0) return dateCompare;
      return a.txId.localeCompare(b.txId);
    }),
    invoices: [...input.invoices].sort((a, b) => {
      const dateCompare = (a.issueDate ?? "").localeCompare(b.issueDate ?? "");
      if (dateCompare !== 0) return dateCompare;
      return a.invoiceId.localeCompare(b.invoiceId);
    }),
    matches: [...input.matches].sort((a, b) => a.matchId.localeCompare(b.matchId)),
    adjustments: [...input.adjustments],
    generatedAt: input.generatedAt,
    periodLockHash: input.periodLockHash,
    schemaVersion: 1,
  };
}
