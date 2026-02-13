"use strict";
/**
 * VAT Summary - read model
 * Pure projection logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildVatSummaryReadModel = buildVatSummaryReadModel;
function buildVatSummaryReadModel(input) {
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
//# sourceMappingURL=vatSummary.js.map