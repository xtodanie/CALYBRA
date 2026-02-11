/**
 * VAT summary - period totals by rate and direction
 * Pure logic. No IO, no randomness, no time.
 */

import { amountFromCents, CurrencyCode } from "../../domain/money";
import { calculateVatFromGross } from "../../domain/money/vat";

export interface VatInvoiceInput {
  readonly invoiceId: string;
  readonly totalGrossCents: number;
  readonly vatRatePercent: number;
  readonly currency: CurrencyCode;
  readonly direction?: "SALES" | "EXPENSE"; // default EXPENSE
}

export interface VatRateBucket {
  readonly rate: number;
  invoiceCount: number;
  baseCents: number;
  vatCents: number;
  grossCents: number;
}

export interface VatSummaryResult {
  readonly currency: CurrencyCode;
  readonly collectedVatCents: number;
  readonly paidVatCents: number;
  readonly netVatCents: number;
  readonly buckets: readonly VatRateBucket[];
}

export function computeVatSummary(
  invoices: readonly VatInvoiceInput[],
  currency: CurrencyCode,
  bucketRates: readonly number[] = [21, 10, 4, 0]
): VatSummaryResult {
  const buckets = new Map<number, VatRateBucket>();
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
    if (invoice.currency !== currency) continue;
    const gross = amountFromCents(invoice.totalGrossCents, currency);
    const vatLine = calculateVatFromGross(gross, invoice.vatRatePercent);

    const rate = invoice.vatRatePercent;
    const bucket = buckets.get(rate) ?? {
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

    const direction = invoice.direction ?? "EXPENSE";
    if (direction === "SALES") {
      collectedVatCents += vatLine.vat.cents;
    } else {
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
