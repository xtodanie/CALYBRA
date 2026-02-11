/**
 * Summary PDF Export Tests
 */

import { generateSummaryPdf } from "../../../server/exports/summaryPdf";

describe("generateSummaryPdf", () => {
  it("creates a PDF payload", () => {
    const result = generateSummaryPdf({
      tenantId: "tenant-1",
      tenantName: "Tenant One",
      monthKey: "2026-01",
      currency: "EUR",
      revenueCents: 10000,
      expenseCents: 5000,
      vatCents: 1000,
      netVatCents: 200,
      unmatchedCount: 2,
      mismatchBankTxCount: 1,
      mismatchInvoiceCount: 1,
      finalAccuracyStatement: "Final accuracy was reached on Day 10.",
      varianceResolvedStatement: "80% of variance resolved in the last 10 days.",
      generatedAt: "2026-02-05T00:00:00Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const content = Buffer.from(result.value.content).toString("utf8");
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("Calybra Month Summary");
  });

  it("fails when missing tenantId", () => {
    const result = generateSummaryPdf({
      tenantId: "",
      tenantName: "Tenant One",
      monthKey: "2026-01",
      currency: "EUR",
      revenueCents: 0,
      expenseCents: 0,
      vatCents: 0,
      netVatCents: 0,
      unmatchedCount: 0,
      mismatchBankTxCount: 0,
      mismatchInvoiceCount: 0,
      finalAccuracyStatement: "Final accuracy was reached on Day 0.",
      varianceResolvedStatement: "100% of variance resolved in the last 0 days.",
      generatedAt: "2026-02-05T00:00:00Z",
    });

    expect(result.success).toBe(false);
  });
});
