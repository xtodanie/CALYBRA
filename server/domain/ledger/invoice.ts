/**
 * Invoice domain entity
 * Pure type. No IO, no randomness, no time.
 */

import { Amount, amountFromDecimal, CurrencyCode } from "../money";
import { VatLine, calculateVatFromGross } from "../money/vat";

/**
 * Invoice entity - represents an invoice extracted from a document
 */
export interface Invoice {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly supplierNameRaw: string;
  readonly invoiceNumber: string;
  readonly issueDate: string; // YYYY-MM-DD
  readonly totalGross: Amount;
  readonly vatLines: readonly VatLine[];
  readonly extractionConfidence: number; // 0-100
  readonly needsReview: boolean;
  readonly sourceFileId: string;
  readonly supplierId?: string;
}

/**
 * Input for creating an Invoice from parsed data
 */
export interface InvoiceInput {
  readonly id: string;
  readonly tenantId: string;
  readonly monthCloseId: string;
  readonly supplierNameRaw: string;
  readonly invoiceNumber: string;
  readonly issueDate: string;
  readonly totalGross: number; // Decimal value
  readonly currency: CurrencyCode;
  readonly vatRate?: number; // Percentage, e.g., 21
  readonly extractionConfidence: number;
  readonly sourceFileId: string;
  readonly supplierId?: string;
}

/**
 * Confidence threshold below which needsReview is true
 */
export const REVIEW_THRESHOLD = 80;

/**
 * Creates an Invoice from input data
 * @throws if input is invalid
 */
export function createInvoice(input: InvoiceInput): Invoice {
  assertNonEmpty(input.id, "id");
  assertNonEmpty(input.tenantId, "tenantId");
  assertNonEmpty(input.monthCloseId, "monthCloseId");
  assertNonEmpty(input.supplierNameRaw, "supplierNameRaw");
  assertNonEmpty(input.invoiceNumber, "invoiceNumber");
  assertValidDate(input.issueDate);
  assertNonEmpty(input.sourceFileId, "sourceFileId");
  assertConfidence(input.extractionConfidence);

  const totalGross = amountFromDecimal(input.totalGross, input.currency);
  const vatRate = input.vatRate ?? 0;
  const vatLines = vatRate > 0 ? [calculateVatFromGross(totalGross, vatRate)] : [];
  const needsReview = input.extractionConfidence < REVIEW_THRESHOLD;

  return {
    id: input.id,
    tenantId: input.tenantId,
    monthCloseId: input.monthCloseId,
    supplierNameRaw: input.supplierNameRaw,
    invoiceNumber: input.invoiceNumber,
    issueDate: input.issueDate,
    totalGross,
    vatLines,
    extractionConfidence: input.extractionConfidence,
    needsReview,
    sourceFileId: input.sourceFileId,
    supplierId: input.supplierId,
  };
}

/**
 * Calculates the net (base) amount from an invoice by subtracting VAT
 */
export function getInvoiceNet(invoice: Invoice): Amount {
  if (invoice.vatLines.length === 0) {
    return invoice.totalGross;
  }

  let totalVatCents = 0;
  for (const line of invoice.vatLines) {
    totalVatCents += line.vat.cents;
  }

  return {
    cents: invoice.totalGross.cents - totalVatCents,
    currency: invoice.totalGross.currency,
  };
}

/**
 * Checks if invoice needs human review
 */
export function requiresReview(invoice: Invoice): boolean {
  return invoice.needsReview;
}

/**
 * Checks if a given invoice number format is valid
 */
export function isValidInvoiceNumber(invoiceNumber: string): boolean {
  // At minimum, must have some alphanumeric content
  return /[a-zA-Z0-9]/.test(invoiceNumber) && invoiceNumber.trim().length > 0;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function assertNonEmpty(value: string, field: string): void {
  if (!value || value.trim().length === 0) {
    throw new Error(`Invoice ${field} must not be empty`);
  }
}

function assertValidDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
  }
}

function assertConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 100) {
    throw new Error(`Confidence must be between 0 and 100, got: ${confidence}`);
  }
}
