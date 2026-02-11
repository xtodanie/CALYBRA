/**
 * Invoice Totals - Comprehensive invoice aggregate calculations
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: All calculations are deterministic
 * INVARIANT: Same inputs always produce same outputs
 * INVARIANT: Integer cents for all monetary math
 *
 * @module accounting/invoiceTotals
 */

import {
  Amount,
  amountFromCents,
  CurrencyCode,
} from "../../domain/money";
import {
  VatLine,
  calculateVatFromGross,
  groupVatByRate,
} from "../../domain/money/vat";
import {
  BusinessErrorCode,
  createBusinessError,
} from "../errors/businessErrors";
import { Result, ok, err } from "../errors/normalizeError";

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Invoice line item input for calculations
 */
export interface InvoiceLineInput {
  readonly invoiceId: string;
  readonly lineNumber: number;
  readonly description: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly vatRatePercent: number;
  readonly currency: CurrencyCode;
}

/**
 * Invoice summary input for aggregate calculations
 */
export interface InvoiceSummaryInput {
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly supplierName: string;
  readonly invoiceNumber: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly totalGrossCents: number;
  readonly vatRatePercent: number;
  readonly currency: CurrencyCode;
  readonly isMatched: boolean;
}

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Calculated line item totals
 */
export interface InvoiceLineTotal {
  readonly lineNumber: number;
  readonly netAmount: Amount;
  readonly vatAmount: Amount;
  readonly grossAmount: Amount;
  readonly vatRate: number;
}

/**
 * Complete invoice totals breakdown
 */
export interface InvoiceTotals {
  readonly invoiceId: string;
  readonly lineCount: number;
  readonly totalNet: Amount;
  readonly totalVat: Amount;
  readonly totalGross: Amount;
  readonly vatByRate: ReadonlyMap<number, VatLine>;
  readonly lineTotals: readonly InvoiceLineTotal[];
}

/**
 * Period invoice aggregates
 */
export interface PeriodInvoiceAggregates {
  readonly currency: CurrencyCode;
  readonly invoiceCount: number;
  readonly totalNetAmount: Amount;
  readonly totalVatAmount: Amount;
  readonly totalGrossAmount: Amount;
  readonly matchedNetAmount: Amount;
  readonly matchedVatAmount: Amount;
  readonly matchedGrossAmount: Amount;
  readonly unmatchedNetAmount: Amount;
  readonly unmatchedVatAmount: Amount;
  readonly unmatchedGrossAmount: Amount;
  readonly matchedCount: number;
  readonly unmatchedCount: number;
  readonly vatBreakdown: ReadonlyMap<number, VatRateSummary>;
  readonly supplierSummary: readonly SupplierSummary[];
  readonly monthlyTrend: readonly MonthlyTotal[];
}

/**
 * VAT breakdown by rate
 */
export interface VatRateSummary {
  readonly rate: number;
  readonly invoiceCount: number;
  readonly totalBase: Amount;
  readonly totalVat: Amount;
  readonly totalGross: Amount;
}

/**
 * Summary per supplier
 */
export interface SupplierSummary {
  readonly supplierName: string;
  readonly invoiceCount: number;
  readonly totalGross: Amount;
  readonly matchedCount: number;
}

/**
 * Monthly totals for trending
 */
export interface MonthlyTotal {
  readonly month: string; // YYYY-MM
  readonly invoiceCount: number;
  readonly totalGross: Amount;
  readonly totalVat: Amount;
}

// ============================================================================
// LINE ITEM CALCULATIONS
// ============================================================================

/**
 * Calculates totals for a single invoice line
 *
 * @param line - Invoice line input
 * @returns Result with line totals or error
 */
export function calculateLineTotal(
  line: InvoiceLineInput
): Result<InvoiceLineTotal> {
  // Validate inputs
  if (line.quantity < 0) {
    return err(
      createBusinessError(BusinessErrorCode.VALUE_OUT_OF_RANGE, {
        message: `Quantity cannot be negative: ${line.quantity}`,
        details: { lineNumber: line.lineNumber, quantity: line.quantity },
      })
    );
  }

  if (line.vatRatePercent < 0 || line.vatRatePercent > 100) {
    return err(
      createBusinessError(BusinessErrorCode.INVALID_VAT_RATE, {
        message: `VAT rate must be between 0 and 100: ${line.vatRatePercent}`,
        details: { lineNumber: line.lineNumber, vatRate: line.vatRatePercent },
      })
    );
  }

  // Calculate net amount (quantity * unit price)
  const netCents = bankersRound(line.quantity * line.unitPriceCents);
  const netAmount = amountFromCents(netCents, line.currency);

  // For line items, we calculate from net, not gross
  const vatCents = bankersRound((netCents * line.vatRatePercent) / 100);
  const vatAmount = amountFromCents(vatCents, line.currency);
  const grossAmount = amountFromCents(netCents + vatCents, line.currency);

  return ok({
    lineNumber: line.lineNumber,
    netAmount,
    vatAmount,
    grossAmount,
    vatRate: line.vatRatePercent,
  });
}

/**
 * Calculates totals for an invoice from line items
 *
 * @param invoiceId - Invoice identifier
 * @param lines - Array of invoice lines
 * @returns Result with invoice totals or error
 */
export function calculateInvoiceTotals(
  invoiceId: string,
  lines: readonly InvoiceLineInput[]
): Result<InvoiceTotals> {
  if (lines.length === 0) {
    return err(
      createBusinessError(BusinessErrorCode.EMPTY_COLLECTION, {
        message: "Invoice must have at least one line item",
        details: { invoiceId },
      })
    );
  }

  // Check currency consistency
  const currency = lines[0].currency;
  for (const line of lines) {
    if (line.currency !== currency) {
      return err(
        createBusinessError(BusinessErrorCode.CURRENCY_MISMATCH, {
          message: `All lines must have the same currency. Expected ${currency}, got ${line.currency}`,
          details: {
            invoiceId,
            expectedCurrency: currency,
            actualCurrency: line.currency,
            lineNumber: line.lineNumber,
          },
        })
      );
    }
  }

  // Calculate each line
  const lineTotals: InvoiceLineTotal[] = [];
  for (const line of lines) {
    const result = calculateLineTotal(line);
    if (!result.success) {
      return result as Result<InvoiceTotals>;
    }
    lineTotals.push(result.value);
  }

  // Aggregate totals
  let totalNetCents = 0;
  let totalVatCents = 0;
  let totalGrossCents = 0;

  const vatLines: VatLine[] = [];

  for (const lineTotal of lineTotals) {
    totalNetCents += lineTotal.netAmount.cents;
    totalVatCents += lineTotal.vatAmount.cents;
    totalGrossCents += lineTotal.grossAmount.cents;

    // Create VatLine for grouping
    vatLines.push({
      base: lineTotal.netAmount,
      rate: lineTotal.vatRate,
      vat: lineTotal.vatAmount,
      gross: lineTotal.grossAmount,
    });
  }

  const vatByRate = groupVatByRate(vatLines);

  return ok({
    invoiceId,
    lineCount: lines.length,
    totalNet: amountFromCents(totalNetCents, currency),
    totalVat: amountFromCents(totalVatCents, currency),
    totalGross: amountFromCents(totalGrossCents, currency),
    vatByRate,
    lineTotals,
  });
}

// ============================================================================
// PERIOD AGGREGATE CALCULATIONS
// ============================================================================

/**
 * Calculates period-wide invoice aggregates
 *
 * @param invoices - Array of invoice summaries
 * @param currency - Period currency
 * @returns Result with period aggregates or error
 */
export function calculatePeriodInvoiceAggregates(
  invoices: readonly InvoiceSummaryInput[],
  currency: CurrencyCode
): Result<PeriodInvoiceAggregates> {
  if (invoices.length === 0) {
    return ok(createEmptyAggregates(currency));
  }

  // Validate currency consistency
  for (const inv of invoices) {
    if (inv.currency !== currency) {
      return err(
        createBusinessError(BusinessErrorCode.CURRENCY_MISMATCH, {
          message: `Invoice currency mismatch. Expected ${currency}, got ${inv.currency}`,
          details: {
            invoiceId: inv.invoiceId,
            expectedCurrency: currency,
            actualCurrency: inv.currency,
          },
        })
      );
    }
  }

  // Calculate VAT breakdown and totals
  const vatByRate = new Map<number, VatRateSummary>();
  const supplierMap = new Map<string, SupplierSummary>();
  const monthlyMap = new Map<string, MonthlyTotal>();

  let totalNetCents = 0;
  let totalVatCents = 0;
  let totalGrossCents = 0;
  let matchedNetCents = 0;
  let matchedVatCents = 0;
  let matchedGrossCents = 0;
  let matchedCount = 0;

  for (const inv of invoices) {
    // Calculate VAT from gross
    const vatLine = calculateVatFromGross(
      amountFromCents(inv.totalGrossCents, currency),
      inv.vatRatePercent
    );

    const netCents = vatLine.base.cents;
    const vatCents = vatLine.vat.cents;
    const grossCents = inv.totalGrossCents;

    totalNetCents += netCents;
    totalVatCents += vatCents;
    totalGrossCents += grossCents;

    if (inv.isMatched) {
      matchedNetCents += netCents;
      matchedVatCents += vatCents;
      matchedGrossCents += grossCents;
      matchedCount++;
    }

    // VAT by rate
    const existingVat = vatByRate.get(inv.vatRatePercent);
    if (existingVat) {
      vatByRate.set(inv.vatRatePercent, {
        rate: inv.vatRatePercent,
        invoiceCount: existingVat.invoiceCount + 1,
        totalBase: amountFromCents(
          existingVat.totalBase.cents + netCents,
          currency
        ),
        totalVat: amountFromCents(
          existingVat.totalVat.cents + vatCents,
          currency
        ),
        totalGross: amountFromCents(
          existingVat.totalGross.cents + grossCents,
          currency
        ),
      });
    } else {
      vatByRate.set(inv.vatRatePercent, {
        rate: inv.vatRatePercent,
        invoiceCount: 1,
        totalBase: amountFromCents(netCents, currency),
        totalVat: amountFromCents(vatCents, currency),
        totalGross: amountFromCents(grossCents, currency),
      });
    }

    // Supplier summary
    const normalizedSupplier = normalizeSupplierName(inv.supplierName);
    const existingSupplier = supplierMap.get(normalizedSupplier);
    if (existingSupplier) {
      supplierMap.set(normalizedSupplier, {
        supplierName: normalizedSupplier,
        invoiceCount: existingSupplier.invoiceCount + 1,
        totalGross: amountFromCents(
          existingSupplier.totalGross.cents + grossCents,
          currency
        ),
        matchedCount: existingSupplier.matchedCount + (inv.isMatched ? 1 : 0),
      });
    } else {
      supplierMap.set(normalizedSupplier, {
        supplierName: normalizedSupplier,
        invoiceCount: 1,
        totalGross: amountFromCents(grossCents, currency),
        matchedCount: inv.isMatched ? 1 : 0,
      });
    }

    // Monthly trend
    const month = inv.issueDate.slice(0, 7); // YYYY-MM
    const existingMonth = monthlyMap.get(month);
    if (existingMonth) {
      monthlyMap.set(month, {
        month,
        invoiceCount: existingMonth.invoiceCount + 1,
        totalGross: amountFromCents(
          existingMonth.totalGross.cents + grossCents,
          currency
        ),
        totalVat: amountFromCents(
          existingMonth.totalVat.cents + vatCents,
          currency
        ),
      });
    } else {
      monthlyMap.set(month, {
        month,
        invoiceCount: 1,
        totalGross: amountFromCents(grossCents, currency),
        totalVat: amountFromCents(vatCents, currency),
      });
    }
  }

  // Calculate unmatched
  const unmatchedNetCents = totalNetCents - matchedNetCents;
  const unmatchedVatCents = totalVatCents - matchedVatCents;
  const unmatchedGrossCents = totalGrossCents - matchedGrossCents;
  const unmatchedCount = invoices.length - matchedCount;

  // Sort suppliers by total gross descending
  const supplierSummary = Array.from(supplierMap.values()).sort(
    (a, b) => b.totalGross.cents - a.totalGross.cents
  );

  // Sort monthly by month ascending
  const monthlyTrend = Array.from(monthlyMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  return ok({
    currency,
    invoiceCount: invoices.length,
    totalNetAmount: amountFromCents(totalNetCents, currency),
    totalVatAmount: amountFromCents(totalVatCents, currency),
    totalGrossAmount: amountFromCents(totalGrossCents, currency),
    matchedNetAmount: amountFromCents(matchedNetCents, currency),
    matchedVatAmount: amountFromCents(matchedVatCents, currency),
    matchedGrossAmount: amountFromCents(matchedGrossCents, currency),
    unmatchedNetAmount: amountFromCents(unmatchedNetCents, currency),
    unmatchedVatAmount: amountFromCents(unmatchedVatCents, currency),
    unmatchedGrossAmount: amountFromCents(unmatchedGrossCents, currency),
    matchedCount,
    unmatchedCount,
    vatBreakdown: vatByRate,
    supplierSummary,
    monthlyTrend,
  });
}

/**
 * Calculates a single supplier's totals
 */
export function calculateSupplierTotals(
  invoices: readonly InvoiceSummaryInput[],
  supplierName: string,
  currency: CurrencyCode
): Result<SupplierSummary> {
  const normalizedTarget = normalizeSupplierName(supplierName);
  const supplierInvoices = invoices.filter(
    (inv) => normalizeSupplierName(inv.supplierName) === normalizedTarget
  );

  if (supplierInvoices.length === 0) {
    return err(
      createBusinessError(BusinessErrorCode.REFERENCE_NOT_FOUND, {
        message: `No invoices found for supplier: ${supplierName}`,
        details: { supplierName },
      })
    );
  }

  let totalGrossCents = 0;
  let matchedCount = 0;

  for (const inv of supplierInvoices) {
    if (inv.currency !== currency) {
      return err(
        createBusinessError(BusinessErrorCode.CURRENCY_MISMATCH, {
          message: `Invoice currency mismatch. Expected ${currency}, got ${inv.currency}`,
        })
      );
    }
    totalGrossCents += inv.totalGrossCents;
    if (inv.isMatched) {
      matchedCount++;
    }
  }

  return ok({
    supplierName: normalizedTarget,
    invoiceCount: supplierInvoices.length,
    totalGross: amountFromCents(totalGrossCents, currency),
    matchedCount,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Creates empty aggregates for a currency
 */
function createEmptyAggregates(currency: CurrencyCode): PeriodInvoiceAggregates {
  const zero = amountFromCents(0, currency);
  return {
    currency,
    invoiceCount: 0,
    totalNetAmount: zero,
    totalVatAmount: zero,
    totalGrossAmount: zero,
    matchedNetAmount: zero,
    matchedVatAmount: zero,
    matchedGrossAmount: zero,
    unmatchedNetAmount: zero,
    unmatchedVatAmount: zero,
    unmatchedGrossAmount: zero,
    matchedCount: 0,
    unmatchedCount: 0,
    vatBreakdown: new Map(),
    supplierSummary: [],
    monthlyTrend: [],
  };
}

/**
 * Normalizes supplier name for grouping
 */
function normalizeSupplierName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Banker's rounding (round half to even)
 */
function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const decimal = value - floor;

  if (decimal < 0.5) return floor;
  if (decimal > 0.5) return floor + 1;

  // Exactly 0.5 - round to even
  return floor % 2 === 0 ? floor : floor + 1;
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates that invoice totals are consistent
 */
export function validateInvoiceTotals(totals: InvoiceTotals): Result<true> {
  // Verify gross = net + vat
  const expectedGross = totals.totalNet.cents + totals.totalVat.cents;
  if (totals.totalGross.cents !== expectedGross) {
    return err(
      createBusinessError(BusinessErrorCode.CALCULATION_FAILED, {
        message: `Invoice total inconsistency: net(${totals.totalNet.cents}) + vat(${totals.totalVat.cents}) != gross(${totals.totalGross.cents})`,
        details: {
          invoiceId: totals.invoiceId,
          expectedGross,
          actualGross: totals.totalGross.cents,
        },
      })
    );
  }

  // Verify line count matches
  if (totals.lineTotals.length !== totals.lineCount) {
    return err(
      createBusinessError(BusinessErrorCode.INTEGRITY_VIOLATION, {
        message: `Line count mismatch: ${totals.lineTotals.length} != ${totals.lineCount}`,
      })
    );
  }

  return ok(true);
}

/**
 * Calculates the difference between expected and actual totals
 */
export function calculateTotalsDifference(
  expected: InvoiceTotals,
  actual: InvoiceTotals
): { netDiff: number; vatDiff: number; grossDiff: number } {
  return {
    netDiff: actual.totalNet.cents - expected.totalNet.cents,
    vatDiff: actual.totalVat.cents - expected.totalVat.cents,
    grossDiff: actual.totalGross.cents - expected.totalGross.cents,
  };
}
