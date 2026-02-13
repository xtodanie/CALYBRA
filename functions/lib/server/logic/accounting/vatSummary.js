"use strict";
/**
 * VAT summary - period totals by rate and direction
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVatSummary = computeVatSummary;
const money_1 = require("../../domain/money");
const vat_1 = require("../../domain/money/vat");
function computeVatSummary(invoices, currency, bucketRates = [21, 10, 4, 0]) {
    var _a, _b;
    const buckets = new Map();
    let collectedVatCents = 0;
    let paidVatCents = 0;
    const rates = bucketRates.length > 0 ? bucketRates : [0];
    for (const rate of rates) {
        buckets.set(rate, {
            rate,
            invoiceCount: 0,
            baseCents: 0,
            vatCents: 0,
            grossCents: 0,
        });
    }
    for (const invoice of invoices) {
        if (invoice.currency !== currency)
            continue;
        const gross = (0, money_1.amountFromCents)(invoice.totalGrossCents, currency);
        const vatLine = (0, vat_1.calculateVatFromGross)(gross, invoice.vatRatePercent);
        const rate = invoice.vatRatePercent;
        const bucket = (_a = buckets.get(rate)) !== null && _a !== void 0 ? _a : {
            rate,
            invoiceCount: 0,
            baseCents: 0,
            vatCents: 0,
            grossCents: 0,
        };
        bucket.invoiceCount += 1;
        bucket.baseCents += vatLine.base.cents;
        bucket.vatCents += vatLine.vat.cents;
        bucket.grossCents += vatLine.gross.cents;
        buckets.set(rate, bucket);
        const direction = (_b = invoice.direction) !== null && _b !== void 0 ? _b : "EXPENSE";
        if (direction === "SALES") {
            collectedVatCents += vatLine.vat.cents;
        }
        else {
            paidVatCents += vatLine.vat.cents;
        }
    }
    const netVatCents = collectedVatCents - paidVatCents;
    return {
        currency,
        collectedVatCents,
        paidVatCents,
        netVatCents,
        buckets: Array.from(buckets.values()).sort((a, b) => a.rate - b.rate),
    };
}
//# sourceMappingURL=vatSummary.js.map