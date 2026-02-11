/**
 * VAT Summary - read model
 * Pure projection logic. No IO, no randomness, no time.
 */

import { VatSummaryResult, VatRateBucket } from "../logic/accounting/vatSummary";

export interface VatSummaryReadModel {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly currency: string;
  readonly collectedVatCents: number;
  readonly paidVatCents: number;
  readonly netVatCents: number;
  readonly buckets: readonly VatRateBucket[];
  readonly generatedAt: string; // ISO timestamp
  readonly periodLockHash: string;
  readonly schemaVersion: 1;
}

export function buildVatSummaryReadModel(input: {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly summary: VatSummaryResult;
  readonly generatedAt: string;
  readonly periodLockHash: string;
}): VatSummaryReadModel {
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    currency: input.summary.currency,
    collectedVatCents: input.summary.collectedVatCents,
    paidVatCents: input.summary.paidVatCents,
    netVatCents: input.summary.netVatCents,
    buckets: [...input.summary.buckets],
    generatedAt: input.generatedAt,
    periodLockHash: input.periodLockHash,
    schemaVersion: 1,
  };
}
