/**
 * VAT Report CSV Export - Generate VAT report in CSV format
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: Export is deterministic - same inputs produce same output
 * INVARIANT: Output is sorted for stable ordering
 * INVARIANT: No side effects - returns buffer/string only
 *
 * @module exports/vatReportCsv
 */

import { amountFromCents, CurrencyCode } from "../domain/money";
import { calculateVatFromGross } from "../domain/money/vat";
import { Result, ok, err } from "../logic/errors/normalizeError";
import {
  BusinessErrorCode,
  createBusinessError,
} from "../logic/errors/businessErrors";

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Invoice data for VAT report
 */
export interface VatReportInvoice {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly supplierName: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly totalGrossCents: number;
  readonly vatRatePercent: number;
  readonly currency: CurrencyCode;
}

/**
 * VAT report generation options
 */
export interface VatReportOptions {
  /** Report period start (YYYY-MM-DD) */
  readonly periodStart: string;
  /** Report period end (YYYY-MM-DD) */
  readonly periodEnd: string;
  /** Tenant ID for report identification */
  readonly tenantId: string;
  /** Tenant name for report header */
  readonly tenantName?: string;
  /** Report currency */
  readonly currency: CurrencyCode;
  /** Locale for number/date formatting */
  readonly locale: "en" | "es";
  /** CSV delimiter */
  readonly delimiter: "," | ";";
  /** Decimal separator for amounts */
  readonly decimalSeparator: "." | ",";
  /** Include header row */
  readonly includeHeader: boolean;
  /** Include summary section */
  readonly includeSummary: boolean;
  /** Include totals by rate */
  readonly includeTotalsByRate: boolean;
}

/**
 * Default export options
 */
export const DEFAULT_VAT_REPORT_OPTIONS: Omit<
  VatReportOptions,
  "periodStart" | "periodEnd" | "tenantId" | "currency"
> = {
  locale: "en",
  delimiter: ",",
  decimalSeparator: ".",
  includeHeader: true,
  includeSummary: true,
  includeTotalsByRate: true,
};

// ============================================================================
// OUTPUT TYPES
// ============================================================================

/**
 * Calculated invoice line for CSV
 */
export interface VatReportLine {
  readonly invoiceNumber: string;
  readonly supplierName: string;
  readonly issueDate: string;
  readonly netAmount: number; // Decimal
  readonly vatRate: number;
  readonly vatAmount: number; // Decimal
  readonly grossAmount: number; // Decimal
}

/**
 * VAT totals by rate
 */
export interface VatRateTotal {
  readonly rate: number;
  readonly invoiceCount: number;
  readonly netAmount: number;
  readonly vatAmount: number;
  readonly grossAmount: number;
}

/**
 * VAT report result
 */
export interface VatReportResult {
  readonly csvContent: string;
  readonly filename: string;
  readonly lines: readonly VatReportLine[];
  readonly totalsByRate: readonly VatRateTotal[];
  readonly grandTotals: {
    readonly netAmount: number;
    readonly vatAmount: number;
    readonly grossAmount: number;
  };
  readonly metadata: {
    readonly generatedAt: string; // Passed in for determinism
    readonly periodStart: string;
    readonly periodEnd: string;
    readonly tenantId: string;
    readonly currency: CurrencyCode;
    readonly invoiceCount: number;
  };
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================

/**
 * Generates a VAT report in CSV format
 *
 * @param invoices - Array of invoices for the report
 * @param options - Report generation options
 * @param generatedAt - Timestamp for deterministic output (ISO string)
 * @returns Result with VAT report or error
 */
export function generateVatReportCsv(
  invoices: readonly VatReportInvoice[],
  options: VatReportOptions,
  generatedAt: string
): Result<VatReportResult> {
  // Validate options
  if (!isValidDateFormat(options.periodStart)) {
    return err(
      createBusinessError(BusinessErrorCode.INVALID_DATE_FORMAT, {
        message: `Invalid period start date: ${options.periodStart}`,
      })
    );
  }

  if (!isValidDateFormat(options.periodEnd)) {
    return err(
      createBusinessError(BusinessErrorCode.INVALID_DATE_FORMAT, {
        message: `Invalid period end date: ${options.periodEnd}`,
      })
    );
  }

  if (options.periodStart > options.periodEnd) {
    return err(
      createBusinessError(BusinessErrorCode.INVALID_PERIOD, {
        message: "Period start must be before period end",
        details: {
          periodStart: options.periodStart,
          periodEnd: options.periodEnd,
        },
      })
    );
  }

  // Filter invoices within period
  const periodInvoices = invoices.filter(
    (inv) =>
      inv.issueDate >= options.periodStart &&
      inv.issueDate <= options.periodEnd &&
      inv.currency === options.currency
  );

  if (periodInvoices.length === 0) {
    return err(
      createBusinessError(BusinessErrorCode.NO_DATA_TO_EXPORT, {
        message: "No invoices found for the specified period and currency",
        details: {
          periodStart: options.periodStart,
          periodEnd: options.periodEnd,
          currency: options.currency,
        },
      })
    );
  }

  // Calculate line items
  const lines = calculateReportLines(periodInvoices, options.currency);

  // Sort for stable output (by date ascending, then invoice number)
  const sortedLines = [...lines].sort((a, b) => {
    const dateCompare = a.issueDate.localeCompare(b.issueDate);
    if (dateCompare !== 0) return dateCompare;
    return a.invoiceNumber.localeCompare(b.invoiceNumber);
  });

  // Calculate totals by rate
  const totalsByRate = calculateTotalsByRate(sortedLines);

  // Calculate grand totals
  const grandTotals = calculateGrandTotals(sortedLines);

  // Generate CSV content
  const csvContent = buildCsvContent(
    sortedLines,
    totalsByRate,
    grandTotals,
    options
  );

  // Generate filename
  const filename = generateFilename(
    options.tenantId,
    options.periodStart,
    options.periodEnd
  );

  return ok({
    csvContent,
    filename,
    lines: sortedLines,
    totalsByRate,
    grandTotals,
    metadata: {
      generatedAt,
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      tenantId: options.tenantId,
      currency: options.currency,
      invoiceCount: sortedLines.length,
    },
  });
}

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

function calculateReportLines(
  invoices: readonly VatReportInvoice[],
  currency: CurrencyCode
): VatReportLine[] {
  return invoices.map((inv) => {
    const gross = amountFromCents(inv.totalGrossCents, currency);
    const vatLine = calculateVatFromGross(gross, inv.vatRatePercent);

    return {
      invoiceNumber: sanitizeForCsv(inv.invoiceNumber),
      supplierName: sanitizeForCsv(inv.supplierName),
      issueDate: inv.issueDate,
      netAmount: vatLine.base.cents / 100,
      vatRate: inv.vatRatePercent,
      vatAmount: vatLine.vat.cents / 100,
      grossAmount: inv.totalGrossCents / 100,
    };
  });
}

function calculateTotalsByRate(lines: readonly VatReportLine[]): VatRateTotal[] {
  const byRate = new Map<number, VatRateTotal>();

  for (const line of lines) {
    const existing = byRate.get(line.vatRate);
    if (existing) {
      byRate.set(line.vatRate, {
        rate: line.vatRate,
        invoiceCount: existing.invoiceCount + 1,
        netAmount: roundToTwoDecimals(existing.netAmount + line.netAmount),
        vatAmount: roundToTwoDecimals(existing.vatAmount + line.vatAmount),
        grossAmount: roundToTwoDecimals(existing.grossAmount + line.grossAmount),
      });
    } else {
      byRate.set(line.vatRate, {
        rate: line.vatRate,
        invoiceCount: 1,
        netAmount: line.netAmount,
        vatAmount: line.vatAmount,
        grossAmount: line.grossAmount,
      });
    }
  }

  // Sort by rate ascending
  return Array.from(byRate.values()).sort((a, b) => a.rate - b.rate);
}

function calculateGrandTotals(
  lines: readonly VatReportLine[]
): VatReportResult["grandTotals"] {
  let netAmount = 0;
  let vatAmount = 0;
  let grossAmount = 0;

  for (const line of lines) {
    netAmount += line.netAmount;
    vatAmount += line.vatAmount;
    grossAmount += line.grossAmount;
  }

  return {
    netAmount: roundToTwoDecimals(netAmount),
    vatAmount: roundToTwoDecimals(vatAmount),
    grossAmount: roundToTwoDecimals(grossAmount),
  };
}

// ============================================================================
// CSV GENERATION
// ============================================================================

function buildCsvContent(
  lines: readonly VatReportLine[],
  totalsByRate: readonly VatRateTotal[],
  grandTotals: VatReportResult["grandTotals"],
  options: VatReportOptions
): string {
  const rows: string[] = [];
  const { delimiter, decimalSeparator, locale } = options;

  // Labels based on locale
  const labels = getLabels(locale);

  // Header row
  if (options.includeHeader) {
    rows.push(
      [
        labels.invoiceNumber,
        labels.supplier,
        labels.date,
        labels.netAmount,
        labels.vatRate,
        labels.vatAmount,
        labels.grossAmount,
      ].join(delimiter)
    );
  }

  // Data rows
  for (const line of lines) {
    rows.push(
      [
        escapeCsvField(line.invoiceNumber, delimiter),
        escapeCsvField(line.supplierName, delimiter),
        formatDate(line.issueDate, locale),
        formatAmount(line.netAmount, decimalSeparator),
        formatPercent(line.vatRate, decimalSeparator),
        formatAmount(line.vatAmount, decimalSeparator),
        formatAmount(line.grossAmount, decimalSeparator),
      ].join(delimiter)
    );
  }

  // Summary section
  if (options.includeSummary) {
    rows.push(""); // Empty row

    if (options.includeTotalsByRate) {
      rows.push(
        [labels.vatSummary, "", "", "", "", "", ""].join(delimiter)
      );
      rows.push(
        [
          labels.rate,
          labels.invoiceCount,
          "",
          labels.totalNet,
          "",
          labels.totalVat,
          labels.totalGross,
        ].join(delimiter)
      );

      for (const total of totalsByRate) {
        rows.push(
          [
            formatPercent(total.rate, decimalSeparator),
            total.invoiceCount.toString(),
            "",
            formatAmount(total.netAmount, decimalSeparator),
            "",
            formatAmount(total.vatAmount, decimalSeparator),
            formatAmount(total.grossAmount, decimalSeparator),
          ].join(delimiter)
        );
      }

      rows.push(""); // Empty row
    }

    // Grand totals
    rows.push(
      [
        labels.grandTotal,
        "",
        "",
        formatAmount(grandTotals.netAmount, decimalSeparator),
        "",
        formatAmount(grandTotals.vatAmount, decimalSeparator),
        formatAmount(grandTotals.grossAmount, decimalSeparator),
      ].join(delimiter)
    );
  }

  return rows.join("\n");
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

interface Labels {
  invoiceNumber: string;
  supplier: string;
  date: string;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
  vatSummary: string;
  rate: string;
  invoiceCount: string;
  totalNet: string;
  totalVat: string;
  totalGross: string;
  grandTotal: string;
}

function getLabels(locale: "en" | "es"): Labels {
  if (locale === "es") {
    return {
      invoiceNumber: "Número de Factura",
      supplier: "Proveedor",
      date: "Fecha",
      netAmount: "Base Imponible",
      vatRate: "Tipo IVA",
      vatAmount: "Cuota IVA",
      grossAmount: "Total",
      vatSummary: "Resumen IVA",
      rate: "Tipo",
      invoiceCount: "Facturas",
      totalNet: "Base Total",
      totalVat: "IVA Total",
      totalGross: "Total",
      grandTotal: "TOTAL GENERAL",
    };
  }

  return {
    invoiceNumber: "Invoice Number",
    supplier: "Supplier",
    date: "Date",
    netAmount: "Net Amount",
    vatRate: "VAT Rate",
    vatAmount: "VAT Amount",
    grossAmount: "Gross Amount",
    vatSummary: "VAT Summary",
    rate: "Rate",
    invoiceCount: "Invoices",
    totalNet: "Total Net",
    totalVat: "Total VAT",
    totalGross: "Total Gross",
    grandTotal: "GRAND TOTAL",
  };
}

function formatAmount(value: number, decimalSeparator: "." | ","): string {
  const formatted = value.toFixed(2);
  if (decimalSeparator === ",") {
    return formatted.replace(".", ",");
  }
  return formatted;
}

function formatPercent(value: number, decimalSeparator: "." | ","): string {
  const formatted = value.toFixed(2) + "%";
  if (decimalSeparator === ",") {
    return formatted.replace(".", ",");
  }
  return formatted;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function formatDate(isoDate: string, _locale?: string): string {
  // Return as-is for simplicity and determinism
  // ISO format (YYYY-MM-DD) is universally understood
  // Note: locale parameter reserved for future localized date formatting
  return isoDate;
}

function escapeCsvField(value: string, delimiter: string): string {
  // If field contains delimiter, quotes, or newlines, wrap in quotes
  if (
    value.includes(delimiter) ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    // Escape quotes by doubling them
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }
  return value;
}

function sanitizeForCsv(value: string): string {
  // Remove or replace problematic characters
  return value
    .replace(/[\r\n]+/g, " ")
    .replace(/\t/g, " ")
    .trim();
}

function generateFilename(
  tenantId: string,
  periodStart: string,
  periodEnd: string
): string {
  const start = periodStart.replace(/-/g, "");
  const end = periodEnd.replace(/-/g, "");
  return `vat_report_${tenantId}_${start}_${end}.csv`;
}

// ============================================================================
// VALIDATION & UTILITY
// ============================================================================

function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

// ============================================================================
// AGGREGATE REPORT
// ============================================================================

/**
 * Generates a summary-only VAT report (no line items)
 */
export function generateVatSummaryCsv(
  invoices: readonly VatReportInvoice[],
  options: VatReportOptions,
  generatedAt: string
): Result<string> {
  const reportResult = generateVatReportCsv(invoices, options, generatedAt);

  if (!reportResult.success) {
    return reportResult as Result<string>;
  }

  const { totalsByRate, grandTotals } = reportResult.value;
  const { delimiter, decimalSeparator, locale } = options;
  const labels = getLabels(locale);

  const rows: string[] = [];

  // Header
  rows.push(
    [
      labels.rate,
      labels.invoiceCount,
      labels.totalNet,
      labels.totalVat,
      labels.totalGross,
    ].join(delimiter)
  );

  // Rate rows
  for (const total of totalsByRate) {
    rows.push(
      [
        formatPercent(total.rate, decimalSeparator),
        total.invoiceCount.toString(),
        formatAmount(total.netAmount, decimalSeparator),
        formatAmount(total.vatAmount, decimalSeparator),
        formatAmount(total.grossAmount, decimalSeparator),
      ].join(delimiter)
    );
  }

  // Grand total
  rows.push(
    [
      labels.grandTotal,
      reportResult.value.metadata.invoiceCount.toString(),
      formatAmount(grandTotals.netAmount, decimalSeparator),
      formatAmount(grandTotals.vatAmount, decimalSeparator),
      formatAmount(grandTotals.grossAmount, decimalSeparator),
    ].join(delimiter)
  );

  return ok(rows.join("\n"));
}

// ============================================================================
// MODELO 303 (SPANISH VAT RETURN) HELPERS
// ============================================================================

/**
 * Spanish Modelo 303 field mappings
 */
export interface Modelo303Fields {
  /** Box 01: IVA general - base */
  base21: number;
  /** Box 02: IVA general - cuota */
  cuota21: number;
  /** Box 04: IVA reducido - base */
  base10: number;
  /** Box 05: IVA reducido - cuota */
  cuota10: number;
  /** Box 07: IVA superreducido - base */
  base4: number;
  /** Box 08: IVA superreducido - cuota */
  cuota4: number;
  /** Total base imponible */
  totalBase: number;
  /** Total cuotas */
  totalCuota: number;
}

/**
 * Extracts Modelo 303 fields from VAT report data
 */
export function extractModelo303Fields(
  totalsByRate: readonly VatRateTotal[]
): Modelo303Fields {
  const rateMap = new Map(totalsByRate.map((t) => [t.rate, t]));

  const get21 = rateMap.get(21);
  const get10 = rateMap.get(10);
  const get4 = rateMap.get(4);

  const base21 = get21?.netAmount ?? 0;
  const cuota21 = get21?.vatAmount ?? 0;
  const base10 = get10?.netAmount ?? 0;
  const cuota10 = get10?.vatAmount ?? 0;
  const base4 = get4?.netAmount ?? 0;
  const cuota4 = get4?.vatAmount ?? 0;

  return {
    base21,
    cuota21,
    base10,
    cuota10,
    base4,
    cuota4,
    totalBase: roundToTwoDecimals(base21 + base10 + base4),
    totalCuota: roundToTwoDecimals(cuota21 + cuota10 + cuota4),
  };
}
