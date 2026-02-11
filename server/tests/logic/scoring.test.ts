/**
 * Matching scoring tests - validate determinism
 */

import {
  calculateMatchScore,
  ScoringInput,
  SCORE_WEIGHTS,
} from "../../logic/matching/scoring";
import { amountFromCents } from "../../domain/money/amount";

describe("Match Scoring", () => {
  const baseTxAmount = amountFromCents(10000, "EUR"); // €100.00
  const baseInvoiceAmount = amountFromCents(10000, "EUR");

  describe("amount scoring", () => {
    it("scores exact amount match at max weight", () => {
      const input: ScoringInput = {
        txAmount: baseTxAmount,
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-20",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.amountScore).toBe(SCORE_WEIGHTS.AMOUNT_EXACT);
    });

    it("scores close amount match", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(10050, "EUR"), // €100.50 (0.5% diff)
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-20",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.amountScore).toBe(SCORE_WEIGHTS.AMOUNT_CLOSE);
    });

    it("scores zero for amount mismatch", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(20000, "EUR"), // €200.00
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-20",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.amountScore).toBe(0);
    });

    it("scores zero for currency mismatch", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(10000, "USD"),
        invoiceAmount: amountFromCents(10000, "EUR"),
        txDate: "2024-01-15",
        invoiceDate: "2024-01-20",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.amountScore).toBe(0);
    });
  });

  describe("date scoring", () => {
    it("scores exact date match", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(5000, "EUR"),
        invoiceAmount: amountFromCents(6000, "EUR"),
        txDate: "2024-01-15",
        invoiceDate: "2024-01-15",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.dateScore).toBe(SCORE_WEIGHTS.DATE_MATCH);
    });

    it("scores close date match (within tolerance)", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(5000, "EUR"),
        invoiceAmount: amountFromCents(6000, "EUR"),
        txDate: "2024-01-15",
        invoiceDate: "2024-01-17", // 2 days diff
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.dateScore).toBe(SCORE_WEIGHTS.DATE_CLOSE);
    });

    it("scores zero for distant dates", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(5000, "EUR"),
        invoiceAmount: amountFromCents(6000, "EUR"),
        txDate: "2024-01-15",
        invoiceDate: "2024-02-15", // 31 days diff
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
      };

      const result = calculateMatchScore(input);
      expect(result.dateScore).toBe(0);
    });
  });

  describe("reference scoring", () => {
    it("scores exact reference match", () => {
      const input: ScoringInput = {
        txAmount: baseTxAmount,
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-15",
        txDescription: "Payment",
        invoiceSupplier: "Supplier",
        txReference: "INV-2024-001",
        invoiceNumber: "INV-2024-001",
      };

      const result = calculateMatchScore(input);
      expect(result.referenceScore).toBe(SCORE_WEIGHTS.REFERENCE_MATCH);
    });

    it("scores partial reference match", () => {
      const input: ScoringInput = {
        txAmount: baseTxAmount,
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-15",
        txDescription: "Payment ref INV2024001",
        invoiceSupplier: "Supplier",
        txReference: "INV2024001",
        invoiceNumber: "INV-2024-001-A",
      };

      const result = calculateMatchScore(input);
      expect(result.referenceScore).toBeGreaterThan(0);
    });
  });

  describe("counterparty scoring", () => {
    it("scores counterparty match", () => {
      const input: ScoringInput = {
        txAmount: baseTxAmount,
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-15",
        txDescription: "Payment",
        invoiceSupplier: "Acme Corporation",
        txCounterparty: "Acme Corporation",
      };

      const result = calculateMatchScore(input);
      expect(result.counterpartyScore).toBe(SCORE_WEIGHTS.COUNTERPARTY_MATCH);
    });
  });

  describe("total score capping", () => {
    it("caps total score at 100", () => {
      const input: ScoringInput = {
        txAmount: baseTxAmount,
        invoiceAmount: baseInvoiceAmount,
        txDate: "2024-01-15",
        invoiceDate: "2024-01-15",
        txDescription: "ACME Corp payment",
        invoiceSupplier: "ACME Corp",
        txReference: "INV-001",
        invoiceNumber: "INV-001",
        txCounterparty: "ACME Corp",
      };

      const result = calculateMatchScore(input);
      expect(result.total).toBeLessThanOrEqual(100);
    });
  });

  describe("determinism", () => {
    it("produces identical results for identical inputs", () => {
      const input: ScoringInput = {
        txAmount: amountFromCents(15000, "EUR"),
        invoiceAmount: amountFromCents(15000, "EUR"),
        txDate: "2024-03-15",
        invoiceDate: "2024-03-14",
        txDescription: "Wire transfer ACME",
        invoiceSupplier: "ACME Industries",
        txReference: "REF123456",
        invoiceNumber: "INV-123456",
        txCounterparty: "ACME",
      };

      const results: number[] = [];
      for (let i = 0; i < 10; i++) {
        results.push(calculateMatchScore(input).total);
      }

      // All results should be identical
      expect(new Set(results).size).toBe(1);
    });
  });
});
