/**
 * Counterfactual month close calculations
 * Pure logic. No IO, no randomness, no time.
 */

import { Event, dateKeyFromIso, addDaysToDateKey, sortEvents } from "../../domain/events";
import { Amount, amountFromCents, CurrencyCode } from "../../domain/money";
import { bankersRound } from "../../domain/money/rounding";
import { calculateVatFromGross } from "../../domain/money/vat";
import { buildLedgerSnapshot, LedgerSnapshot } from "./ledgerSnapshot";

export interface CounterfactualInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly periodStart: string; // YYYY-MM-DD
  readonly periodEnd: string; // YYYY-MM-DD
  readonly currency: CurrencyCode;
  readonly asOfDays: readonly number[];
  readonly finalAsOfDate: string; // YYYY-MM-DD
  readonly events: readonly Event[];
}

export interface CounterfactualTimelineEntry {
  readonly asOfDay: number | null; // null for final
  readonly asOfDate: string; // YYYY-MM-DD
  readonly revenueCents: number;
  readonly expenseCents: number;
  readonly vatCents: number;
  readonly unmatchedBankCount: number;
  readonly unmatchedInvoiceCount: number;
  readonly unmatchedTotalCount: number;
}

export interface CounterfactualTimelineResult {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: CurrencyCode;
  readonly asOfDays: readonly number[];
  readonly entries: readonly CounterfactualTimelineEntry[];
  readonly insights: readonly string[];
}


export function computeCounterfactualTimeline(
  input: CounterfactualInput
): CounterfactualTimelineResult {
  const asOfDays = normalizeAsOfDays(input.asOfDays);
  const monthEvents = sortEvents(
    input.events.filter((event) => event.monthKey === input.monthKey)
  );

  const entries: CounterfactualTimelineEntry[] = [];

  for (const day of asOfDays) {
    const cutoffDate = addDaysToDateKey(input.periodEnd, day);
    const events = monthEvents.filter(
      (event) => dateKeyFromIso(event.occurredAt) <= cutoffDate
    );
    entries.push(
      buildEntryFromEvents(input.currency, cutoffDate, day, events)
    );
  }

  const finalEntry = buildEntryFromEvents(
    input.currency,
    input.finalAsOfDate,
    null,
    monthEvents
  );
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

function buildEntryFromEvents(
  currency: CurrencyCode,
  asOfDate: string,
  asOfDay: number | null,
  events: readonly Event[]
): CounterfactualTimelineEntry {
  const snapshot = buildLedgerSnapshot(events);
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
    unmatchedTotalCount:
      unmatched.unmatchedBankCount + unmatched.unmatchedInvoiceCount,
  };
}

function computeTotals(snapshot: LedgerSnapshot, currency: CurrencyCode): {
  revenueCents: number;
  expenseCents: number;
  vatCents: number;
} {
  let revenueCents = 0;
  let expenseCents = 0;
  let vatCents = 0;

  for (const tx of snapshot.bankTx) {
    if (tx.currency !== currency) continue;
    if (tx.amountCents >= 0) {
      revenueCents += tx.amountCents;
    } else {
      expenseCents += Math.abs(tx.amountCents);
    }
  }

  for (const adjustment of snapshot.adjustments) {
    if (adjustment.currency !== currency) continue;
    if (adjustment.category === "REVENUE") {
      revenueCents += Math.abs(adjustment.amountCents);
    } else if (adjustment.category === "EXPENSE") {
      expenseCents += Math.abs(adjustment.amountCents);
    } else if (adjustment.category === "VAT") {
      vatCents += adjustment.amountCents;
    }
  }

  for (const invoice of snapshot.invoices) {
    if (invoice.currency !== currency) continue;
    const gross = amountFromCents(invoice.totalGrossCents, currency);
    const vatLine = calculateVatFromGross(gross, invoice.vatRatePercent);
    vatCents += vatLine.vat.cents;
  }

  return { revenueCents, expenseCents, vatCents };
}

function computeUnmatchedCounts(
  snapshot: LedgerSnapshot,
  currency: CurrencyCode
): { unmatchedBankCount: number; unmatchedInvoiceCount: number } {
  const confirmedMatches = snapshot.matches.filter(
    (match) => match.status === "CONFIRMED"
  );

  const matchedBankTxIds = new Set<string>();
  const invoiceMatchedCents = new Map<string, number>();

  for (const match of confirmedMatches) {
    for (const txId of match.bankTxIds) {
      matchedBankTxIds.add(txId);
    }

    for (const invoiceId of match.invoiceIds) {
      const invoice = snapshot.invoices.find((inv) => inv.invoiceId === invoiceId);
      if (!invoice || invoice.currency !== currency) continue;
      let matchedSum = invoiceMatchedCents.get(invoiceId) ?? 0;
      for (const txId of match.bankTxIds) {
        const tx = snapshot.bankTx.find((item) => item.txId === txId);
        if (!tx || tx.currency !== currency) continue;
        matchedSum += Math.abs(tx.amountCents);
      }
      invoiceMatchedCents.set(invoiceId, matchedSum);
    }
  }

  const bankTxCount = snapshot.bankTx.filter(
    (tx) => tx.currency === currency
  ).length;
  const unmatchedBankCount = bankTxCount - matchedBankTxIds.size;

  let unmatchedInvoiceCount = 0;
  for (const invoice of snapshot.invoices) {
    if (invoice.currency !== currency) continue;
    const matchedSum = invoiceMatchedCents.get(invoice.invoiceId) ?? 0;
    if (matchedSum < invoice.totalGrossCents) {
      unmatchedInvoiceCount += 1;
    }
  }

  return {
    unmatchedBankCount: Math.max(0, unmatchedBankCount),
    unmatchedInvoiceCount,
  };
}

function buildInsights(
  entries: readonly CounterfactualTimelineEntry[],
  asOfDays: readonly number[]
): readonly string[] {
  if (entries.length === 0) return [];
  const finalEntry = entries[entries.length - 1];

  let finalAccuracyDay: number | null = null;
  for (const entry of entries) {
    if (entry.asOfDay === null) continue;
    if (entryMatchesFinal(entry, finalEntry)) {
      finalAccuracyDay = entry.asOfDay;
      break;
    }
  }
  const fallbackDay = asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
  const dayX = finalAccuracyDay ?? fallbackDay;

  const varianceByEntry = entries.map((entry) =>
    calculateVariance(entry, finalEntry)
  );

  const initialVariance = varianceByEntry[0];
  const lastVariance = varianceByEntry[varianceByEntry.length - 1];
  const prevVariance =
    varianceByEntry.length > 1
      ? varianceByEntry[varianceByEntry.length - 2]
      : varianceByEntry[varianceByEntry.length - 1];

  const totalReduction = initialVariance - lastVariance;
  const lastIntervalReduction = prevVariance - lastVariance;

  const percentResolved =
    totalReduction === 0
      ? 100
      : bankersRound((lastIntervalReduction / totalReduction) * 100);

  const finalDay = asOfDays.length > 0 ? asOfDays[asOfDays.length - 1] : 0;
  const prevDay = asOfDays.length > 1 ? asOfDays[asOfDays.length - 2] : finalDay;
  const lastIntervalDays = Math.max(0, finalDay - prevDay);

  return [
    `Final accuracy was reached on Day ${dayX}.`,
    `${percentResolved}% of variance resolved in the last ${lastIntervalDays} days.`,
  ];
}

function entryMatchesFinal(
  entry: CounterfactualTimelineEntry,
  finalEntry: CounterfactualTimelineEntry
): boolean {
  return (
    entry.revenueCents === finalEntry.revenueCents &&
    entry.expenseCents === finalEntry.expenseCents &&
    entry.vatCents === finalEntry.vatCents &&
    entry.unmatchedTotalCount === finalEntry.unmatchedTotalCount
  );
}

function calculateVariance(
  entry: CounterfactualTimelineEntry,
  finalEntry: CounterfactualTimelineEntry
): number {
  return (
    Math.abs(entry.revenueCents - finalEntry.revenueCents) +
    Math.abs(entry.expenseCents - finalEntry.expenseCents) +
    Math.abs(entry.vatCents - finalEntry.vatCents) +
    Math.abs(entry.unmatchedTotalCount - finalEntry.unmatchedTotalCount)
  );
}

function normalizeAsOfDays(days: readonly number[]): number[] {
  const filtered = days.filter((day) => Number.isFinite(day) && day >= 0);
  return Array.from(new Set(filtered)).sort((a, b) => a - b);
}

export function centsToAmount(cents: number, currency: CurrencyCode): Amount {
  return amountFromCents(cents, currency);
}
