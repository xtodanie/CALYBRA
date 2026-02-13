"use strict";
/**
 * Currency value object - ISO 4217 currency codes
 * Pure type + validation. No IO, no randomness, no time.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENCY_DECIMALS = exports.SUPPORTED_CURRENCIES = void 0;
exports.isSupportedCurrency = isSupportedCurrency;
exports.assertCurrency = assertCurrency;
exports.getDecimalPlaces = getDecimalPlaces;
// Supported currencies (extend as needed)
exports.SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "MXN"];
// Currency configuration (decimal places per currency)
exports.CURRENCY_DECIMALS = {
    EUR: 2,
    USD: 2,
    GBP: 2,
    CHF: 2,
    MXN: 2,
};
/**
 * Validates that a string is a supported ISO 4217 currency code
 */
function isSupportedCurrency(code) {
    return exports.SUPPORTED_CURRENCIES.includes(code);
}
/**
 * Asserts that a string is a supported currency, throws if not
 */
function assertCurrency(code) {
    if (!isSupportedCurrency(code)) {
        throw new Error(`Unsupported currency: '${code}'. Supported: [${exports.SUPPORTED_CURRENCIES.join(", ")}]`);
    }
    return code;
}
/**
 * Returns the number of decimal places for a currency
 */
function getDecimalPlaces(currency) {
    return exports.CURRENCY_DECIMALS[currency];
}
//# sourceMappingURL=currency.js.map