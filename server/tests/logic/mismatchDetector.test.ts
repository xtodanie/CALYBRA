/**
 * Mismatch Detector Tests
 */

import { detectMismatches } from "../../../server/logic/accounting/mismatchDetector";

describe("detectMismatches", () => {
  it("detects bank tx without invoice and partial/over payments", () => {
    const result = detectMismatches(
      [
        { txId: "tx-1", bookingDate: "2026-01-01", amountCents: 5000, currency: "EUR" },
        { txId: "tx-2", bookingDate: "2026-01-02", amountCents: 2000, currency: "EUR" },
      ],
      [
        { invoiceId: "inv-1", issueDate: "2026-01-03", totalGrossCents: 6000, currency: "EUR" },
        { invoiceId: "inv-2", issueDate: "2026-01-04", totalGrossCents: 1000, currency: "EUR" },
      ],
      [
        {
          matchId: "m-1",
          status: "CONFIRMED",
          bankTxIds: ["tx-1"],
          invoiceIds: ["inv-1"],
        },
        {
          matchId: "m-2",
          status: "CONFIRMED",
          bankTxIds: ["tx-2"],
          invoiceIds: ["inv-2"],
        },
      ],
      "EUR"
    );

    expect(result.bankTxWithoutInvoice).toHaveLength(0);
    expect(result.partialPayments).toContain("inv-1");
    expect(result.overpayments).toContain("inv-2");
  });

  it("flags invoice matched without bank tx", () => {
    const result = detectMismatches(
      [],
      [{ invoiceId: "inv-1", issueDate: "2026-01-03", totalGrossCents: 6000, currency: "EUR" }],
      [
        {
          matchId: "m-1",
          status: "CONFIRMED",
          bankTxIds: [],
          invoiceIds: ["inv-1"],
        },
      ],
      "EUR"
    );

    expect(result.invoiceMatchedWithoutBankTx).toContain("inv-1");
  });

  it("lists bank transactions without matches", () => {
    const result = detectMismatches(
      [{ txId: "tx-1", bookingDate: "2026-01-01", amountCents: 5000, currency: "EUR" }],
      [],
      [],
      "EUR"
    );

    expect(result.bankTxWithoutInvoice).toEqual(["tx-1"]);
  });
});
