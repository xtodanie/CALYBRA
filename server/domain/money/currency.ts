/**
 * Currency value object - ISO 4217 currency codes
 * Pure type + validation. No IO, no randomness, no time.
 */

// Supported currencies (extend as needed)
export const SUPPORTED_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "MXN"] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

// Currency configuration (decimal places per currency)
export const CURRENCY_DECIMALS: Record<CurrencyCode, number> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  CHF: 2,
  MXN: 2,
} as const;

/**
 * Validates that a string is a supported ISO 4217 currency code
 */
export function isSupportedCurrency(code: string): code is CurrencyCode {
  return SUPPORTED_CURRENCIES.includes(code as CurrencyCode);
}

/**
 * Asserts that a string is a supported currency, throws if not
 */
export function assertCurrency(code: string): CurrencyCode {
  if (!isSupportedCurrency(code)) {
    throw new Error(
      `Unsupported currency: '${code}'. Supported: [${SUPPORTED_CURRENCIES.join(", ")}]`
    );
  }
  return code;
}

/**
 * Returns the number of decimal places for a currency
 */
export function getDecimalPlaces(currency: CurrencyCode): number {
  return CURRENCY_DECIMALS[currency];
}
