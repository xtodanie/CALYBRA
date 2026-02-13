"use strict";
/**
 * Ledger snapshot builder for counterfactual views
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLedgerSnapshot = buildLedgerSnapshot;
function buildLedgerSnapshot(events) {
    var _a;
    const bankTxById = new Map();
    const invoiceById = new Map();
    const matchById = new Map();
    const adjustments = [];
    for (const event of events) {
        switch (event.type) {
            case "BANK_TX_ARRIVED": {
                const payload = event.payload;
                bankTxById.set(payload.txId, {
                    txId: payload.txId,
                    bookingDate: payload.bookingDate,
                    amountCents: payload.amountCents,
                    currency: payload.currency,
                    descriptionRaw: payload.descriptionRaw,
                });
                break;
            }
            case "INVOICE_CREATED":
            case "INVOICE_UPDATED": {
                const payload = event.payload;
                invoiceById.set(payload.invoiceId, {
                    invoiceId: payload.invoiceId,
                    issueDate: payload.issueDate,
                    invoiceNumber: payload.invoiceNumber,
                    supplierNameRaw: payload.supplierNameRaw,
                    totalGrossCents: payload.totalGrossCents,
                    vatRatePercent: payload.vatRatePercent,
                    currency: payload.currency,
                    direction: (_a = payload.direction) !== null && _a !== void 0 ? _a : "EXPENSE",
                });
                break;
            }
            case "MATCH_RESOLVED": {
                const payload = event.payload;
                matchById.set(payload.matchId, {
                    matchId: payload.matchId,
                    status: payload.status,
                    bankTxIds: payload.bankTxIds,
                    invoiceIds: payload.invoiceIds,
                    matchType: payload.matchType,
                    score: payload.score,
                });
                break;
            }
            case "ADJUSTMENT_POSTED": {
                const payload = event.payload;
                adjustments.push({
                    adjustmentId: payload.adjustmentId,
                    category: payload.category,
                    amountCents: payload.amountCents,
                    currency: payload.currency,
                });
                break;
            }
            default:
                break;
        }
    }
    return {
        bankTx: [...bankTxById.values()],
        invoices: [...invoiceById.values()],
        matches: [...matchById.values()],
        adjustments,
    };
}
//# sourceMappingURL=ledgerSnapshot.js.map