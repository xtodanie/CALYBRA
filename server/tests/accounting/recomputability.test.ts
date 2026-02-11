/**
 * Accounting recomputability tests
 * 
 * Tests assert TRUTH: given raw data, recomputing produces identical results.
 * No implementation details, no mock verification.
 */

import {
  calculatePeriodBalance,
  PeriodBalance,
  isReconciled,
  isWithinTolerance,
} from "../../logic/accounting/balances";
import {
  calculateAggregates,
  calculateExceptionCounts,
  ExceptionCounts,
} from "../../logic/accounting/aggregates";
import {
  generateReconciliationReport,
  ReconciliationReport,
} from "../../logic/accounting/reconciliation";

describe("Accounting Recomputability", () => {
  describe("calculatePeriodBalance", () => {
    it("computes correct balance", () => {
      const result = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [1000, 2000, -500],
        invoiceAmounts: [1200, 1500],
        matchedBankTxAmounts: [1000],
        matchedInvoiceAmounts: [1200],
      });

      expect(result.bankTotal.cents).toBe(250000); // 2500 * 100 cents
      expect(result.invoiceTotal.cents).toBe(270000); // 2700 * 100 cents
      expect(result.difference.cents).toBe(-20000); // 2500 - 2700 = -200 * 100
      expect(result.unmatchedBankCount).toBe(2); // 2000 and -500
      expect(result.unmatchedInvoiceCount).toBe(1); // 1500
    });

    it("is recomputable - same input yields same result", () => {
      const input = {
        currency: "EUR" as const,
        bankTxAmounts: [500, 750, 1000, -250],
        invoiceAmounts: [600, 800, 500],
        matchedBankTxAmounts: [500, 750],
        matchedInvoiceAmounts: [600, 800],
      };

      const result1 = calculatePeriodBalance(input);
      const result2 = calculatePeriodBalance(input);

      expect(result1.bankTotal.cents).toBe(result2.bankTotal.cents);
      expect(result1.invoiceTotal.cents).toBe(result2.invoiceTotal.cents);
      expect(result1.difference.cents).toBe(result2.difference.cents);
      expect(result1.unmatchedBankCount).toBe(result2.unmatchedBankCount);
      expect(result1.unmatchedInvoiceCount).toBe(result2.unmatchedInvoiceCount);
    });

    it("handles empty inputs", () => {
      const result = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [],
        invoiceAmounts: [],
        matchedBankTxAmounts: [],
        matchedInvoiceAmounts: [],
      });

      expect(result.bankTotal.cents).toBe(0);
      expect(result.invoiceTotal.cents).toBe(0);
      expect(result.difference.cents).toBe(0);
    });

    it("isReconciled returns true when difference is zero", () => {
      const result = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [100],
        invoiceAmounts: [100],
        matchedBankTxAmounts: [100],
        matchedInvoiceAmounts: [100],
      });

      expect(isReconciled(result)).toBe(true);
    });

    it("isWithinTolerance works correctly", () => {
      const result = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [100.50], // 10050 cents
        invoiceAmounts: [100], // 10000 cents
        matchedBankTxAmounts: [],
        matchedInvoiceAmounts: [],
      });

      // Difference is 50 cents
      expect(isWithinTolerance(result, 50)).toBe(true);
      expect(isWithinTolerance(result, 49)).toBe(false);
    });

    it("is deterministic across many runs", () => {
      const input = {
        currency: "EUR" as const,
        bankTxAmounts: [123.45, 678.90, -234.56, 999.99],
        invoiceAmounts: [111.11, 222.22, 333.33, 444.44],
        matchedBankTxAmounts: [123.45],
        matchedInvoiceAmounts: [111.11],
      };

      const results: PeriodBalance[] = [];
      for (let i = 0; i < 20; i++) {
        results.push(calculatePeriodBalance(input));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].bankTotal.cents).toBe(results[0].bankTotal.cents);
        expect(results[i].invoiceTotal.cents).toBe(results[0].invoiceTotal.cents);
        expect(results[i].difference.cents).toBe(results[0].difference.cents);
      }
    });
  });

  describe("calculateAggregates", () => {
    it("computes correct aggregates", () => {
      const result = calculateAggregates(
        [100, 200, -50],
        [150, 100],
        2,
        "EUR"
      );

      expect(result.transactionCount).toBe(3);
      expect(result.invoiceCount).toBe(2);
      expect(result.matchCount).toBe(2);
    });

    it("is recomputable", () => {
      const txAmounts = [500, 750, -200];
      const invAmounts = [600, 400];

      const result1 = calculateAggregates(txAmounts, invAmounts, 1, "EUR");
      const result2 = calculateAggregates(txAmounts, invAmounts, 1, "EUR");

      expect(result1.transactionCount).toBe(result2.transactionCount);
      expect(result1.matchCount).toBe(result2.matchCount);
    });
  });

  describe("calculateExceptionCounts", () => {
    it("computes exception counts correctly", () => {
      const result = calculateExceptionCounts(5, 3, 2, 1);

      expect(result.highPriority).toBe(3); // min(5, 3)
      expect(result.mediumPriority).toBe(2); // ambiguous
      expect(result.lowPriority).toBe(1); // low confidence
      expect(result.totalOpen).toBe(6);
    });

    it("is deterministic", () => {
      const results: ExceptionCounts[] = [];
      for (let i = 0; i < 5; i++) {
        results.push(calculateExceptionCounts(10, 8, 5, 3));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].totalOpen).toBe(results[0].totalOpen);
        expect(results[i].highPriority).toBe(results[0].highPriority);
      }
    });
  });

  describe("generateReconciliationReport", () => {
    it("generates complete report", () => {
      const balance = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [500, 300],
        invoiceAmounts: [480, 320],
        matchedBankTxAmounts: [500],
        matchedInvoiceAmounts: [480],
      });

      const aggregates = calculateAggregates(
        [500, 300],
        [480, 320],
        1,
        "EUR"
      );

      const exceptions = calculateExceptionCounts(1, 1, 0, 0);

      const result = generateReconciliationReport(
        balance,
        aggregates,
        exceptions
      );

      expect(result.status).toBeDefined();
      expect(result.matchPercentage).toBeDefined();
      expect(result.readyToFinalize).toBeDefined();
    });

    it("is recomputable across runs", () => {
      const balance = calculatePeriodBalance({
        currency: "EUR",
        bankTxAmounts: [1000, 2000],
        invoiceAmounts: [1000, 2000],
        matchedBankTxAmounts: [1000, 2000],
        matchedInvoiceAmounts: [1000, 2000],
      });

      const aggregates = calculateAggregates(
        [1000, 2000],
        [1000, 2000],
        2,
        "EUR"
      );

      const exceptions = calculateExceptionCounts(0, 0, 0, 0);

      const results: ReconciliationReport[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(generateReconciliationReport(balance, aggregates, exceptions));
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].status).toBe(results[0].status);
        expect(results[i].readyToFinalize).toBe(results[0].readyToFinalize);
        expect(results[i].matchPercentage).toBe(results[0].matchPercentage);
      }
    });
  });

  describe("Full accounting pipeline recomputability", () => {
    it("complete pipeline is deterministic", () => {
      const bankTxAmounts = [1000, 2000, 3000, -500, 1500];
      const invoiceAmounts = [1200, 2500, 2800, 800];
      const matchedBankTxAmounts = [1000, 2000];
      const matchedInvoiceAmounts = [1200, 2500];

      const runPipeline = () => {
        const balance = calculatePeriodBalance({
          currency: "EUR",
          bankTxAmounts,
          invoiceAmounts,
          matchedBankTxAmounts,
          matchedInvoiceAmounts,
        });

        const aggregates = calculateAggregates(
          bankTxAmounts,
          invoiceAmounts,
          matchedBankTxAmounts.length,
          "EUR"
        );

        const exceptions = calculateExceptionCounts(
          balance.unmatchedBankCount,
          balance.unmatchedInvoiceCount,
          0,
          0
        );

        const report = generateReconciliationReport(
          balance,
          aggregates,
          exceptions
        );

        return { balance, aggregates, report };
      };

      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(runPipeline());
      }

      for (let i = 1; i < results.length; i++) {
        expect(results[i].balance.bankTotal.cents).toBe(results[0].balance.bankTotal.cents);
        expect(results[i].balance.invoiceTotal.cents).toBe(results[0].balance.invoiceTotal.cents);
        expect(results[i].aggregates.matchCount).toBe(results[0].aggregates.matchCount);
        expect(results[i].report.status).toBe(results[0].report.status);
        expect(results[i].report.readyToFinalize).toBe(results[0].report.readyToFinalize);
      }
    });
  });
});
