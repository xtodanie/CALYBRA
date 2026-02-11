/**
 * Readmodels Tests - counterfactual related
 */

import { buildMonthCloseTimelineReadModel } from "../../../server/readmodels/monthCloseTimeline";
import { buildCloseFrictionReadModel } from "../../../server/readmodels/closeFriction";
import { buildVatSummaryReadModel } from "../../../server/readmodels/vatSummary";
import { buildMismatchSummaryReadModel } from "../../../server/readmodels/mismatchSummary";
import { buildAuditorReplaySnapshot } from "../../../server/readmodels/auditorReplay";

const timelineEntry = {
  asOfDay: 5,
  asOfDate: "2026-02-05",
  revenueCents: 1000,
  expenseCents: 500,
  vatCents: 50,
  unmatchedBankCount: 1,
  unmatchedInvoiceCount: 0,
  unmatchedTotalCount: 1,
};

describe("Readmodels builders", () => {
  it("builds month close timeline readmodel", () => {
    const model = buildMonthCloseTimelineReadModel({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      periodEnd: "2026-01-31",
      asOfDays: [5],
      entries: [timelineEntry],
      insights: ["Final accuracy was reached on Day 5.", "100% of variance resolved in the last 0 days."],
      generatedAt: "2026-02-05T00:00:00Z",
      periodLockHash: "hash",
    });

    expect(model.entries).toHaveLength(1);
    expect(model.schemaVersion).toBe(1);
  });

  it("builds close friction readmodel", () => {
    const model = buildCloseFrictionReadModel({
      result: {
        tenantId: "tenant-1",
        monthKey: "2026-01",
        lateArrivalPercent: 10,
        adjustmentAfterClosePercent: 5,
        reconciliationHalfLifeDays: 3,
        closeFrictionScore: 80,
      },
      periodEnd: "2026-01-31",
      dayForLateArrival: 5,
      generatedAt: "2026-02-05T00:00:00Z",
      periodLockHash: "hash",
    });

    expect(model.closeFrictionScore).toBe(80);
  });

  it("builds VAT summary readmodel", () => {
    const model = buildVatSummaryReadModel({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      summary: {
        currency: "EUR",
        collectedVatCents: 100,
        paidVatCents: 50,
        netVatCents: 50,
        buckets: [{ rate: 21, invoiceCount: 1, baseCents: 1000, vatCents: 210, grossCents: 1210 }],
      },
      generatedAt: "2026-02-05T00:00:00Z",
      periodLockHash: "hash",
    });

    expect(model.buckets[0].rate).toBe(21);
  });

  it("builds mismatch summary readmodel", () => {
    const model = buildMismatchSummaryReadModel({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      summary: {
        bankTxWithoutInvoice: ["tx-1"],
        invoiceMatchedWithoutBankTx: [],
        partialPayments: [],
        overpayments: [],
      },
      generatedAt: "2026-02-05T00:00:00Z",
      periodLockHash: "hash",
    });

    expect(model.bankTxWithoutInvoice).toContain("tx-1");
  });

  it("builds auditor replay snapshot", () => {
    const model = buildAuditorReplaySnapshot({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      asOfDateKey: "2026-02-05",
      bankTx: [{ txId: "tx-1", bookingDate: "2026-01-01", amountCents: 100, currency: "EUR" }],
      invoices: [{ invoiceId: "inv-1", issueDate: "2026-01-01", invoiceNumber: "INV-1", supplierNameRaw: "Supplier", totalGrossCents: 100, vatRatePercent: 0, currency: "EUR", direction: "EXPENSE" }],
      matches: [{ matchId: "m-1", status: "CONFIRMED", bankTxIds: ["tx-1"], invoiceIds: ["inv-1"] }],
      adjustments: [],
      generatedAt: "2026-02-05T00:00:00Z",
      periodLockHash: "hash",
    });

    expect(model.bankTx[0].txId).toBe("tx-1");
  });
});
