/**
 * VAT Summary Tests
 */

import { computeVatSummary } from "../../../server/logic/accounting/vatSummary";

describe("computeVatSummary", () => {
  it("aggregates VAT by rate and direction", () => {
    const result = computeVatSummary(
      [
        {
          invoiceId: "inv-1",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "EUR",
          direction: "EXPENSE",
        },
        {
          invoiceId: "inv-2",
          totalGrossCents: 11000,
          vatRatePercent: 10,
          currency: "EUR",
          direction: "SALES",
        },
      ],
      "EUR",
      [21, 10]
    );

    expect(result.paidVatCents).toBeGreaterThan(0);
    expect(result.collectedVatCents).toBeGreaterThan(0);
    expect(result.buckets).toHaveLength(2);
  });

  it("ignores invoices with different currency", () => {
    const result = computeVatSummary(
      [
        {
          invoiceId: "inv-1",
          totalGrossCents: 12100,
          vatRatePercent: 21,
          currency: "USD",
          direction: "EXPENSE",
        },
      ],
      "EUR"
    );

    expect(result.paidVatCents).toBe(0);
    expect(result.buckets.length).toBeGreaterThan(0);
  });

  it("handles empty invoices", () => {
    const result = computeVatSummary([], "EUR", [21]);
    expect(result.collectedVatCents).toBe(0);
    expect(result.paidVatCents).toBe(0);
  });
});
