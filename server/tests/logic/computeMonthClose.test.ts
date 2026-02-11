/**
 * Month Close computation tests - validate determinism and recomputability
 */

import {
  computeMonthClose,
  MonthCloseInput,
  MonthCloseResult,
  validateRecomputability,
  createEmptyMonthCloseResult,
} from "../../logic/accounting/computeMonthClose";

describe("computeMonthClose", () => {
  const baseInput: MonthCloseInput = {
    tenantId: "tenant-1",
    monthCloseId: "mc-2024-01",
    periodStart: "2024-01-01",
    periodEnd: "2024-01-31",
    currency: "EUR",
    bankTxAmounts: [],
    invoiceAmounts: [],
    matchedBankTxAmounts: [],
    matchedInvoiceAmounts: [],
    proposedMatchCount: 0,
    confirmedMatchCount: 0,
    lowConfidenceMatchCount: 0,
    ambiguousMatchCount: 0,
  };

  describe("basic computation", () => {
    it("computes empty month close", () => {
      const result = computeMonthClose(baseInput);

      expect(result.bankTotal).toBe(0);
      expect(result.invoiceTotal).toBe(0);
      expect(result.diff).toBe(0);
      expect(result.openExceptionsCount).toBe(0);
    });

    it("computes totals correctly", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200, 300],
        invoiceAmounts: [150, 250],
      };

      const result = computeMonthClose(input);

      expect(result.bankTotal).toBe(600);
      expect(result.invoiceTotal).toBe(400);
      expect(result.diff).toBe(200);
    });

    it("handles negative amounts (debits)", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [1000, -200, -300],
      };

      const result = computeMonthClose(input);
      expect(result.bankTotal).toBe(500); // 1000 - 200 - 300
    });
  });

  describe("matching metrics", () => {
    it("calculates unmatched counts", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200, 300, 400, 500],
        invoiceAmounts: [100, 200, 300],
        matchedBankTxAmounts: [100, 200],
        matchedInvoiceAmounts: [100, 200],
        confirmedMatchCount: 2,
      };

      const result = computeMonthClose(input);

      expect(result.balance.unmatchedBankCount).toBe(3);
      expect(result.balance.unmatchedInvoiceCount).toBe(1);
    });

    it("includes match counts in aggregates", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200],
        invoiceAmounts: [100, 200],
        matchedBankTxAmounts: [100],
        matchedInvoiceAmounts: [100],
        confirmedMatchCount: 1,
      };

      const result = computeMonthClose(input);
      expect(result.aggregates.matchCount).toBe(1);
    });
  });

  describe("exception counts", () => {
    it("counts open exceptions", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200, 300],
        invoiceAmounts: [100, 200],
        matchedBankTxAmounts: [],
        matchedInvoiceAmounts: [],
        lowConfidenceMatchCount: 1,
        ambiguousMatchCount: 2,
      };

      const result = computeMonthClose(input);
      expect(result.openExceptionsCount).toBeGreaterThan(0);
    });
  });

  describe("finalization checks", () => {
    it("allows finalization when fully reconciled", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200],
        invoiceAmounts: [100, 200],
        matchedBankTxAmounts: [100, 200],
        matchedInvoiceAmounts: [100, 200],
        confirmedMatchCount: 2,
      };

      const result = computeMonthClose(input);
      expect(result.canFinalize).toBe(true);
      expect(result.blockingIssues.length).toBe(0);
    });

    it("blocks finalization with unmatched items", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [100, 200, 300],
        invoiceAmounts: [100, 200],
        matchedBankTxAmounts: [100],
        matchedInvoiceAmounts: [100],
        confirmedMatchCount: 1,
      };

      const result = computeMonthClose(input);
      expect(result.canFinalize).toBe(false);
      expect(result.blockingIssues.length).toBeGreaterThan(0);
    });
  });

  describe("recomputability", () => {
    it("validates matching recomputation", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [1000, 2000, 3000],
        invoiceAmounts: [1500, 2500],
      };

      const result = computeMonthClose(input);

      const stored = {
        bankTotal: result.bankTotal,
        invoiceTotal: result.invoiceTotal,
        diff: result.diff,
      };

      const validation = validateRecomputability(stored, result);
      expect(validation.valid).toBe(true);
      expect(validation.discrepancies.length).toBe(0);
    });

    it("detects recomputation discrepancy", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [1000],
        invoiceAmounts: [500],
      };

      const result = computeMonthClose(input);

      const wrongStored = {
        bankTotal: 9999, // Wrong!
        invoiceTotal: result.invoiceTotal,
        diff: result.diff,
      };

      const validation = validateRecomputability(wrongStored, result);
      expect(validation.valid).toBe(false);
      expect(validation.discrepancies.some(d => d.includes("bankTotal mismatch"))).toBe(true);
    });
  });

  describe("determinism", () => {
    it("produces identical results for identical inputs", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [123.45, 678.90, -234.56],
        invoiceAmounts: [111.11, 222.22, 333.33],
        matchedBankTxAmounts: [123.45],
        matchedInvoiceAmounts: [111.11],
        confirmedMatchCount: 1,
        proposedMatchCount: 2,
        lowConfidenceMatchCount: 1,
        ambiguousMatchCount: 0,
      };

      const results: MonthCloseResult[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(computeMonthClose(input));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].bankTotal).toBe(results[0].bankTotal);
        expect(results[i].invoiceTotal).toBe(results[0].invoiceTotal);
        expect(results[i].diff).toBe(results[0].diff);
        expect(results[i].openExceptionsCount).toBe(results[0].openExceptionsCount);
        expect(results[i].canFinalize).toBe(results[0].canFinalize);
      }
    });

    it("createEmptyMonthCloseResult is deterministic", () => {
      const results: MonthCloseResult[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(
          createEmptyMonthCloseResult("t1", "mc1", "2024-01-01", "2024-01-31", "EUR")
        );
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].bankTotal).toBe(results[0].bankTotal);
        expect(results[i].invoiceTotal).toBe(results[0].invoiceTotal);
      }
    });
  });

  describe("idempotency", () => {
    it("recomputing with same data yields same result", () => {
      const input: MonthCloseInput = {
        ...baseInput,
        bankTxAmounts: [500, 750, -100],
        invoiceAmounts: [600, 400],
        matchedBankTxAmounts: [500],
        matchedInvoiceAmounts: [600],
        confirmedMatchCount: 1,
      };

      const first = computeMonthClose(input);
      const second = computeMonthClose(input);

      expect(first.bankTotal).toBe(second.bankTotal);
      expect(first.invoiceTotal).toBe(second.invoiceTotal);
      expect(first.diff).toBe(second.diff);
      expect(first.reconciliation.status).toBe(second.reconciliation.status);
    });
  });
});
