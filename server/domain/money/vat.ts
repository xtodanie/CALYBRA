/**
 * VAT (Value Added Tax) calculation utilities
 * Pure math. No IO, no randomness, no time.
 *
 * INVARIANT: VAT rates are expressed as percentages (e.g., 21 for 21%)
 * INVARIANT: All calculations use integer arithmetic via Amount
 */

import { Amount, amountFromCents, multiplyAmount } from "./amount";

/**
 * Common VAT rates (extend as needed for jurisdictions)
 */
export const VAT_RATES = {
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
} as const;

export type VatRateKey = keyof typeof VAT_RATES;

/**
 * VAT line item representing a single VAT calculation
 */
export interface VatLine {
  readonly base: Amount; // Net amount before VAT
  readonly rate: number; // VAT rate as percentage (e.g., 21)
  readonly vat: Amount; // VAT amount
  readonly gross: Amount; // Base + VAT
}

/**
 * Calculates VAT from a net (base) amount
 * @param base - The net amount before VAT
 * @param ratePercent - VAT rate as percentage (e.g., 21 for 21%)
 */
export function calculateVatFromNet(base: Amount, ratePercent: number): VatLine {
  assertValidRate(ratePercent);

  const vatMultiplier = ratePercent / 100;
  const vat = multiplyAmount(base, vatMultiplier);
  const gross = amountFromCents(base.cents + vat.cents, base.currency);

  return { base, rate: ratePercent, vat, gross };
}

/**
 * Calculates VAT from a gross amount (extracts VAT)
 * @param gross - The gross amount including VAT
 * @param ratePercent - VAT rate as percentage (e.g., 21 for 21%)
 */
export function calculateVatFromGross(gross: Amount, ratePercent: number): VatLine {
  assertValidRate(ratePercent);

  // gross = base * (1 + rate/100)
  // base = gross / (1 + rate/100)
  const divisor = 1 + ratePercent / 100;
  const baseCents = Math.round(gross.cents / divisor);
  const base = amountFromCents(baseCents, gross.currency);
  const vat = amountFromCents(gross.cents - baseCents, gross.currency);

  return { base, rate: ratePercent, vat, gross };
}

/**
 * Sums multiple VAT lines into aggregate totals
 */
export function sumVatLines(lines: readonly VatLine[]): {
  totalBase: Amount;
  totalVat: Amount;
  totalGross: Amount;
} {
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
    totalBase: amountFromCents(totalBase, currency),
    totalVat: amountFromCents(totalVat, currency),
    totalGross: amountFromCents(totalGross, currency),
  };
}

/**
 * Groups VAT lines by rate and sums each group
 */
export function groupVatByRate(lines: readonly VatLine[]): Map<number, VatLine> {
  const groups = new Map<number, VatLine[]>();

  for (const line of lines) {
    const existing = groups.get(line.rate) ?? [];
    groups.set(line.rate, [...existing, line]);
  }

  const result = new Map<number, VatLine>();
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

function assertValidRate(rate: number): void {
  if (rate < 0 || rate > 100) {
    throw new Error(`Invalid VAT rate: ${rate}. Must be between 0 and 100.`);
  }
}
