/**
 * Counterfactual Close Tests
 */

import { computeCounterfactualTimeline } from "../../../server/logic/counterfactual/counterfactualClose";
import { Event } from "../../../server/domain/events";

const baseEvents: Event[] = [
  {
    id: "evt-1",
    tenantId: "tenant-1",
    type: "BANK_TX_ARRIVED",
    occurredAt: "2026-01-02T10:00:00Z",
    recordedAt: "2026-01-02T10:05:00Z",
    monthKey: "2026-01",
    deterministicId: "tx-1",
    schemaVersion: 1,
    payload: {
      txId: "tx-1",
      bookingDate: "2026-01-02",
      amountCents: 10000,
      currency: "EUR",
      descriptionRaw: "Sale",
    },
  },
  {
    id: "evt-2",
    tenantId: "tenant-1",
    type: "INVOICE_CREATED",
    occurredAt: "2026-01-03T10:00:00Z",
    recordedAt: "2026-01-03T10:05:00Z",
    monthKey: "2026-01",
    deterministicId: "inv-1",
    schemaVersion: 1,
    payload: {
      invoiceId: "inv-1",
      issueDate: "2026-01-03",
      invoiceNumber: "INV-1",
      supplierNameRaw: "Supplier",
      totalGrossCents: 12100,
      vatRatePercent: 21,
      currency: "EUR",
      direction: "EXPENSE",
    },
  },
  {
    id: "evt-3",
    tenantId: "tenant-1",
    type: "MATCH_RESOLVED",
    occurredAt: "2026-01-04T10:00:00Z",
    recordedAt: "2026-01-04T10:05:00Z",
    monthKey: "2026-01",
    deterministicId: "match-1",
    schemaVersion: 1,
    payload: {
      matchId: "match-1",
      status: "CONFIRMED",
      bankTxIds: ["tx-1"],
      invoiceIds: ["inv-1"],
      matchType: "EXACT",
      score: 90,
    },
  },
  {
    id: "evt-4",
    tenantId: "tenant-1",
    type: "ADJUSTMENT_POSTED",
    occurredAt: "2026-01-05T10:00:00Z",
    recordedAt: "2026-01-05T10:05:00Z",
    monthKey: "2026-01",
    deterministicId: "adj-1",
    schemaVersion: 1,
    payload: {
      adjustmentId: "adj-1",
      category: "VAT",
      amountCents: 100,
      currency: "EUR",
      reason: "Correction",
    },
  },
];

describe("computeCounterfactualTimeline", () => {
  it("builds timeline entries and insights", () => {
    const result = computeCounterfactualTimeline({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      currency: "EUR",
      asOfDays: [10, 5, 10, -1],
      finalAsOfDate: "2026-02-05",
      events: baseEvents,
    });

    expect(result.entries).toHaveLength(3);
    expect(result.asOfDays).toEqual([5, 10]);
    expect(result.entries[0].asOfDay).toBe(5);
    expect(result.entries[2].asOfDay).toBeNull();
    expect(result.insights[0]).toMatch("Final accuracy was reached on Day");
    expect(result.insights[1]).toMatch("% of variance resolved in the last");
  });

  it("treats unmatched invoices as unpaid", () => {
    const events = baseEvents.filter((event) => event.type !== "MATCH_RESOLVED");
    const result = computeCounterfactualTimeline({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      currency: "EUR",
      asOfDays: [5],
      finalAsOfDate: "2026-02-05",
      events,
    });

    const finalEntry = result.entries[result.entries.length - 1];
    expect(finalEntry.unmatchedInvoiceCount).toBe(1);
  });

  it("uses fallback day when no checkpoint matches final", () => {
    const events: Event[] = [
      ...baseEvents,
      {
        id: "evt-5",
        tenantId: "tenant-1",
        type: "BANK_TX_ARRIVED",
        occurredAt: "2026-02-10T10:00:00Z",
        recordedAt: "2026-02-10T10:05:00Z",
        monthKey: "2026-01",
        deterministicId: "tx-2",
        schemaVersion: 1,
        payload: {
          txId: "tx-2",
          bookingDate: "2026-02-10",
          amountCents: 5000,
          currency: "EUR",
          descriptionRaw: "Late",
        },
      },
    ];

    const result = computeCounterfactualTimeline({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodStart: "2026-01-01",
      periodEnd: "2026-01-31",
      currency: "EUR",
      asOfDays: [5, 10],
      finalAsOfDate: "2026-02-20",
      events,
    });

    expect(result.insights[0]).toContain("Day 10");
  });
});
