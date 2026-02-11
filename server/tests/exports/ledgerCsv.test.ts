/**
 * Ledger CSV Export Tests
 */

import { generateLedgerCsv } from "../../../server/exports/ledgerCsv";

describe("generateLedgerCsv", () => {
  it("generates deterministic CSV", () => {
    const result = generateLedgerCsv({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      currency: "EUR",
      bankTx: [
        { txId: "tx-2", bookingDate: "2026-01-02", amountCents: 200, currency: "EUR", descriptionRaw: "B" },
        { txId: "tx-1", bookingDate: "2026-01-01", amountCents: 100, currency: "EUR", descriptionRaw: "A" },
      ],
      invoices: [
        { invoiceId: "inv-1", issueDate: "2026-01-03", invoiceNumber: "INV-1", supplierNameRaw: "Supplier", totalGrossCents: 300, currency: "EUR" },
      ],
      matches: [
        { matchId: "m-1", status: "CONFIRMED", bankTxIds: ["tx-1"], invoiceIds: ["inv-1"] },
      ],
      generatedAt: "2026-02-01T00:00:00Z",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const lines = result.value.csvContent.split("\n");
    expect(lines[0]).toContain("recordType");
    expect(lines[1]).toContain("BANK_TX");
  });

  it("fails when no rows", () => {
    const result = generateLedgerCsv({
      tenantId: "tenant-1",
      monthKey: "2026-01",
      currency: "EUR",
      bankTx: [],
      invoices: [],
      matches: [],
      generatedAt: "2026-02-01T00:00:00Z",
    });

    expect(result.success).toBe(false);
  });
});
