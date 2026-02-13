"use strict";
/**
 * Auditor Replay - read model snapshot
 * Pure projection logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAuditorReplaySnapshot = buildAuditorReplaySnapshot;
function buildAuditorReplaySnapshot(input) {
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        asOfDateKey: input.asOfDateKey,
        bankTx: [...input.bankTx].sort((a, b) => {
            var _a, _b;
            const dateCompare = ((_a = a.bookingDate) !== null && _a !== void 0 ? _a : "").localeCompare((_b = b.bookingDate) !== null && _b !== void 0 ? _b : "");
            if (dateCompare !== 0)
                return dateCompare;
            return a.txId.localeCompare(b.txId);
        }),
        invoices: [...input.invoices].sort((a, b) => {
            var _a, _b;
            const dateCompare = ((_a = a.issueDate) !== null && _a !== void 0 ? _a : "").localeCompare((_b = b.issueDate) !== null && _b !== void 0 ? _b : "");
            if (dateCompare !== 0)
                return dateCompare;
            return a.invoiceId.localeCompare(b.invoiceId);
        }),
        matches: [...input.matches].sort((a, b) => a.matchId.localeCompare(b.matchId)),
        adjustments: [...input.adjustments],
        generatedAt: input.generatedAt,
        periodLockHash: input.periodLockHash,
        schemaVersion: 1,
    };
}
//# sourceMappingURL=auditorReplay.js.map