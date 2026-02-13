"use strict";
/**
 * Mismatch Summary - read model
 * Pure projection logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildMismatchSummaryReadModel = buildMismatchSummaryReadModel;
function buildMismatchSummaryReadModel(input) {
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
//# sourceMappingURL=mismatchSummary.js.map