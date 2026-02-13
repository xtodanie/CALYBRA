"use strict";
/**
 * Mismatch detector - bank vs ledger
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectMismatches = detectMismatches;
function detectMismatches(bankTx, invoices, matches, currency) {
    var _a, _b;
    const confirmedMatches = matches.filter((match) => match.status === "CONFIRMED");
    const matchedBankTxIds = new Set();
    const invoiceMatchedCents = new Map();
    const invoiceHasMatchNoBankTx = new Set();
    for (const match of confirmedMatches) {
        if (match.bankTxIds.length === 0) {
            for (const invoiceId of match.invoiceIds) {
                invoiceHasMatchNoBankTx.add(invoiceId);
            }
        }
        for (const txId of match.bankTxIds) {
            matchedBankTxIds.add(txId);
        }
        for (const invoiceId of match.invoiceIds) {
            const invoice = invoices.find((inv) => inv.invoiceId === invoiceId);
            if (!invoice || invoice.currency !== currency)
                continue;
            let matchedSum = (_a = invoiceMatchedCents.get(invoiceId)) !== null && _a !== void 0 ? _a : 0;
            for (const txId of match.bankTxIds) {
                const tx = bankTx.find((item) => item.txId === txId);
                if (!tx || tx.currency !== currency)
                    continue;
                matchedSum += Math.abs(tx.amountCents);
            }
            invoiceMatchedCents.set(invoiceId, matchedSum);
        }
    }
    const bankTxWithoutInvoice = bankTx
        .filter((tx) => tx.currency === currency && !matchedBankTxIds.has(tx.txId))
        .map((tx) => tx.txId)
        .sort();
    const invoiceMatchedWithoutBankTx = invoices
        .filter((inv) => inv.currency === currency && invoiceHasMatchNoBankTx.has(inv.invoiceId))
        .map((inv) => inv.invoiceId)
        .sort();
    const partialPayments = [];
    const overpayments = [];
    for (const invoice of invoices) {
        if (invoice.currency !== currency)
            continue;
        const matchedSum = (_b = invoiceMatchedCents.get(invoice.invoiceId)) !== null && _b !== void 0 ? _b : 0;
        if (matchedSum > 0 && matchedSum < invoice.totalGrossCents) {
            partialPayments.push(invoice.invoiceId);
        }
        else if (matchedSum > invoice.totalGrossCents) {
            overpayments.push(invoice.invoiceId);
        }
    }
    partialPayments.sort();
    overpayments.sort();
    return {
        bankTxWithoutInvoice,
        invoiceMatchedWithoutBankTx,
        partialPayments,
        overpayments,
    };
}
//# sourceMappingURL=mismatchDetector.js.map