"use strict";
/**
 * Counterfactual month close calculations
 * Pure logic. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCounterfactualTimeline = computeCounterfactualTimeline;
exports.centsToAmount = centsToAmount;
const events_1 = require("../../domain/events");
const money_1 = require("../../domain/money");
const rounding_1 = require("../../domain/money/rounding");
const vat_1 = require("../../domain/money/vat");
const ledgerSnapshot_1 = require("./ledgerSnapshot");
function computeCounterfactualTimeline(input) {
    const asOfDays = normalizeAsOfDays(input.asOfDays);
    const monthEvents = (0, events_1.sortEvents)(input.events.filter((event) => event.monthKey === input.monthKey));
    const entries = [];
    for (const day of asOfDays) {
        const cutoffDate = (0, events_1.addDaysToDateKey)(input.periodEnd, day);
        const events = monthEvents.filter((event) => (0, events_1.dateKeyFromIso)(event.occurredAt) <= cutoffDate);
        entries.push(buildEntryFromEvents(input.currency, cutoffDate, day, events));
    }
    const finalEntry = buildEntryFromEvents(input.currency, input.finalAsOfDate, null, monthEvents);
    entries.push(finalEntry);
    const insights = buildInsights(entries, asOfDays);
    return {
        tenantId: input.tenantId,
        monthKey: input.monthKey,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        currency: input.currency,
        asOfDays,
        entries,
        insights,
    };
}
function buildEntryFromEvents(currency, asOfDate, asOfDay, events) {
    const snapshot = (0, ledgerSnapshot_1.buildLedgerSnapshot)(events);
    const totals = computeTotals(snapshot, currency);
    const unmatched = computeUnmatchedCounts(snapshot, currency);
    return {
        asOfDay,
        asOfDate,
        revenueCents: totals.revenueCents,
        expenseCents: totals.expenseCents,
        vatCents: totals.vatCents,
        unmatchedBankCount: unmatched.unmatchedBankCount,
        unmatchedInvoiceCount: unmatched.unmatchedInvoiceCount,
        unmatchedTotalCount: unmatched.unmatchedBankCount + unmatched.unmatchedInvoiceCount,
    };
}
function computeTotals(snapshot, currency) {
    let revenueCents = 0;
    let expenseCents = 0;
    let vatCents = 0;
    for (const tx of snapshot.bankTx) {
        if (tx.currency !== currency)
            continue;
        if (tx.amountCents >= 0) {
            revenueCents += tx.amountCents;
        }
        else {
            expenseCents += Math.abs(tx.amountCents);
        }
    }
    for (const adjustment of snapshot.adjustments) {
        if (adjustment.currency !== currency)
            continue;
        if (adjustment.category === "REVENUE") {
            revenueCents += Math.abs(adjustment.amountCents);
        }
        else if (adjustment.category === "EXPENSE") {
            expenseCents += Math.abs(adjustment.amountCents);
        }
        else if (adjustment.category === "VAT") {
            vatCents += adjustment.amountCents;
        }
    }
    for (const invoice of snapshot.invoices) {
        if (invoice.currency !== currency)
            continue;
        const gross = (0, money_1.amountFromCents)(invoice.totalGrossCents, currency);
        const vatLine = (0, vat_1.calculateVatFromGross)(gross, invoice.vatRatePercent);
        vatCents += vatLine.vat.cents;
    }
    return { revenueCents, expenseCents, vatCents };
}
function computeUnmatchedCounts(snapshot, currency) {
    var _a, _b;
    const confirmedMatches = snapshot.matches.filter((match) => match.status === "CONFIRMED");
    const matchedBankTxIds = new Set();
    const invoiceMatchedCents = new Map();
    for (const match of confirmedMatches) {
        for (const txId of match.bankTxIds) {
            matchedBankTxIds.add(txId);
        }
        for (const invoiceId of match.invoiceIds) {
            const invoice = snapshot.invoices.find((inv) => inv.invoiceId === invoiceId);
            if (!invoice || invoice.currency !== currency)
                continue;
            let matchedSum = (_a = invoiceMatchedCents.get(invoiceId)) !== null && _a !== void 0 ? _a : 0;
            for (const txId of match.bankTxIds) {
                const tx = snapshot.bankTx.find((item) => item.txId === txId);
                if (!tx || tx.currency !== currency)
                    continue;
                matchedSum += Math.abs(tx.amountCents);
            }
            invoiceMatchedCents.set(invoiceId, matchedSum);
        }
    }
    const bankTxCount = snapshot.bankTx.filter((tx) => tx.currency === currency).length;
    const unmatchedBankCount = bankTxCount - matchedBankTxIds.size;
    let unmatchedInvoiceCount = 0;
    for (const invoice of snapshot.invoices) {
        if (invoice.currency !== currency)
            continue;
        const matchedSum = (_b = invoiceMatchedCents.get(invoice.invoiceId)) !== null && _b !== void 0 ? _b : 0;
        if (matchedSum < invoice.totalGrossCents) {
            unmatchedInvoiceCount += 1;
        }
    }
    return {
        unmatchedBankCount: Math.max(0, unmatchedBankCount),
        unmatchedInvoiceCount,
    };
}
function buildInsights(entries, asOfDays) {
    if (entries.length === 0)
        return [];
    const finalEntry = entries[entries.length - 1];
    let finalAccuracyDay = null;
    for (const entry of entries) {
        if (entry.asOfDay === null)
            continue;
        if (entryMatchesFinal(entry, finalEntry)) {
            finalAccuracyDay = entry.asOfDay;
            break;
        }
    }
    const fallbackDay = asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
    const dayX = finalAccuracyDay !== null && finalAccuracyDay !== void 0 ? finalAccuracyDay : fallbackDay;
    const varianceByEntry = entries.map((entry) => calculateVariance(entry, finalEntry));
    const initialVariance = varianceByEntry[0];
    const lastVariance = varianceByEntry[varianceByEntry.length - 1];
    const prevVariance = varianceByEntry.length > 1
        ? varianceByEntry[varianceByEntry.length - 2]
        : varianceByEntry[varianceByEntry.length - 1];
    const totalReduction = initialVariance - lastVariance;
    const lastIntervalReduction = prevVariance - lastVariance;
    const percentResolved = totalReduction === 0
        ? 100
        : (0, rounding_1.bankersRound)((lastIntervalReduction / totalReduction) * 100);
    const finalDay = asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
    const prevDay = asOfDays.length > 1 ? asOfDays[asOfDays.length - 2] : finalDay;
    const lastIntervalDays = Math.max(0, finalDay - prevDay);
    return [
        `Final accuracy was reached on Day ${dayX}.`,
        `${percentResolved}% of variance resolved in the last ${lastIntervalDays} days.`,
    ];
}
function entryMatchesFinal(entry, finalEntry) {
    return (entry.revenueCents === finalEntry.revenueCents &&
        entry.expenseCents === finalEntry.expenseCents &&
        entry.vatCents === finalEntry.vatCents &&
        entry.unmatchedTotalCount === finalEntry.unmatchedTotalCount);
}
function calculateVariance(entry, finalEntry) {
    return (Math.abs(entry.revenueCents - finalEntry.revenueCents) +
        Math.abs(entry.expenseCents - finalEntry.expenseCents) +
        Math.abs(entry.vatCents - finalEntry.vatCents) +
        Math.abs(entry.unmatchedTotalCount - finalEntry.unmatchedTotalCount));
}
function normalizeAsOfDays(days) {
    const filtered = days.filter((day) => Number.isFinite(day) && day >= 0);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
}
function centsToAmount(cents, currency) {
    return (0, money_1.amountFromCents)(cents, currency);
}
//# sourceMappingURL=counterfactualClose.js.map