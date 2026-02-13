"use strict";
/**
 * VAT (Value Added Tax) calculation utilities
 * Pure math. No IO, no randomness, no time.
 *
 * INVARIANT: VAT rates are expressed as percentages (e.g., 21 for 21%)
 * INVARIANT: All calculations use integer arithmetic via Amount
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VAT_RATES = void 0;
exports.calculateVatFromNet = calculateVatFromNet;
exports.calculateVatFromGross = calculateVatFromGross;
exports.sumVatLines = sumVatLines;
exports.groupVatByRate = groupVatByRate;
const amount_1 = require("./amount");
/**
 * Common VAT rates (extend as needed for jurisdictions)
 */
exports.VAT_RATES = {
    SPAIN_GENERAL: 21,
    SPAIN_REDUCED: 10,
    SPAIN_SUPER_REDUCED: 4,
    SPAIN_EXEMPT: 0,
    GERMANY_GENERAL: 19,
    GERMANY_REDUCED: 7,
    UK_GENERAL: 20,
    UK_REDUCED: 5,
    UK_ZERO: 0,
    MEXICO_GENERAL: 16,
    MEXICO_EXEMPT: 0,
};
/**
 * Calculates VAT from a net (base) amount
 * @param base - The net amount before VAT
 * @param ratePercent - VAT rate as percentage (e.g., 21 for 21%)
 */
function calculateVatFromNet(base, ratePercent) {
    assertValidRate(ratePercent);
    const vatMultiplier = ratePercent / 100;
    const vat = (0, amount_1.multiplyAmount)(base, vatMultiplier);
    const gross = (0, amount_1.amountFromCents)(base.cents + vat.cents, base.currency);
    return { base, rate: ratePercent, vat, gross };
}
/**
 * Calculates VAT from a gross amount (extracts VAT)
 * @param gross - The gross amount including VAT
 * @param ratePercent - VAT rate as percentage (e.g., 21 for 21%)
 */
function calculateVatFromGross(gross, ratePercent) {
    assertValidRate(ratePercent);
    // gross = base * (1 + rate/100)
    // base = gross / (1 + rate/100)
    const divisor = 1 + ratePercent / 100;
    const baseCents = Math.round(gross.cents / divisor);
    const base = (0, amount_1.amountFromCents)(baseCents, gross.currency);
    const vat = (0, amount_1.amountFromCents)(gross.cents - baseCents, gross.currency);
    return { base, rate: ratePercent, vat, gross };
}
/**
 * Sums multiple VAT lines into aggregate totals
 */
function sumVatLines(lines) {
    if (lines.length === 0) {
        throw new Error("Cannot sum empty VAT lines array");
    }
    const currency = lines[0].base.currency;
    let totalBase = 0;
    let totalVat = 0;
    let totalGross = 0;
    for (const line of lines) {
        if (line.base.currency !== currency) {
            throw new Error(`Currency mismatch in VAT lines: ${line.base.currency} vs ${currency}`);
        }
        totalBase += line.base.cents;
        totalVat += line.vat.cents;
        totalGross += line.gross.cents;
    }
    return {
        totalBase: (0, amount_1.amountFromCents)(totalBase, currency),
        totalVat: (0, amount_1.amountFromCents)(totalVat, currency),
        totalGross: (0, amount_1.amountFromCents)(totalGross, currency),
    };
}
/**
 * Groups VAT lines by rate and sums each group
 */
function groupVatByRate(lines) {
    var _a;
    const groups = new Map();
    for (const line of lines) {
        const existing = (_a = groups.get(line.rate)) !== null && _a !== void 0 ? _a : [];
        groups.set(line.rate, [...existing, line]);
    }
    const result = new Map();
    for (const [rate, groupLines] of groups) {
        const { totalBase, totalVat, totalGross } = sumVatLines(groupLines);
        result.set(rate, {
            base: totalBase,
            rate,
            vat: totalVat,
            gross: totalGross,
        });
    }
    return result;
}
// ============================================================================
// INTERNAL HELPERS
// ============================================================================
function assertValidRate(rate) {
    if (rate < 0 || rate > 100) {
        throw new Error(`Invalid VAT rate: ${rate}. Must be between 0 and 100.`);
    }
}
//# sourceMappingURL=vat.js.map