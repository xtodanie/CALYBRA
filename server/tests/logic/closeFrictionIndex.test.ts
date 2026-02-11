/**
 * Close Friction Index Tests
 */

import { computeCloseFrictionIndex } from "../../../server/logic/metrics/closeFrictionIndex";
import { CounterfactualTimelineEntry } from "../../../server/logic/counterfactual/counterfactualClose";
import { Event } from "../../../server/domain/events";

describe("computeCloseFrictionIndex", () => {
  it("computes late arrival, adjustments, and score", () => {
    const timeline: CounterfactualTimelineEntry[] = [
      {
        asOfDay: 5,
        asOfDate: "2026-02-05",
        revenueCents: 10000,
        expenseCents: 2000,
        vatCents: 100,
        unmatchedBankCount: 1,
        unmatchedInvoiceCount: 1,
        unmatchedTotalCount: 2,
      },
      {
        asOfDay: null,
        asOfDate: "2026-02-20",
        revenueCents: 12000,
        expenseCents: 2000,
        vatCents: 100,
        unmatchedBankCount: 0,
        unmatchedInvoiceCount: 0,
        unmatchedTotalCount: 0,
      },
    ];

    const events: Event[] = [
      {
        id: "evt-1",
        tenantId: "tenant-1",
        type: "BANK_TX_ARRIVED",
        occurredAt: "2026-01-15T00:00:00Z",
        recordedAt: "2026-02-15T00:00:00Z",
        monthKey: "2026-01",
        deterministicId: "tx-1",
        schemaVersion: 1,
        payload: {
          txId: "tx-1",
          bookingDate: "2026-01-15",
          amountCents: 10000,
          currency: "EUR",
          descriptionRaw: "Sale",
        },
      },
      {
        id: "evt-2",
        tenantId: "tenant-1",
        type: "ADJUSTMENT_POSTED",
        occurredAt: "2026-02-02T00:00:00Z",
        recordedAt: "2026-02-02T00:00:00Z",
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

    const result = computeCloseFrictionIndex({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodEnd: "2026-01-31",
      asOfDays: [5],
      dayForLateArrival: 5,
      events,
      timeline,
    });

    expect(result.lateArrivalPercent).toBe(50);
    expect(result.adjustmentAfterClosePercent).toBe(100);
    expect(result.reconciliationHalfLifeDays).toBe(5);
    expect(result.closeFrictionScore).toBeLessThan(100);
  });

  it("returns zero when no events", () => {
    const result = computeCloseFrictionIndex({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodEnd: "2026-01-31",
      asOfDays: [],
      dayForLateArrival: 5,
      events: [],
      timeline: [],
    });

    expect(result.lateArrivalPercent).toBe(0);
    expect(result.adjustmentAfterClosePercent).toBe(0);
    expect(result.reconciliationHalfLifeDays).toBe(0);
  });
});
