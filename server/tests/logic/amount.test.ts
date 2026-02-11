/**
 * Amount tests - validate determinism and pure math
 */

import {
  amountFromCents,
  amountFromDecimal,
  amountToDecimal,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  sumAmounts,
  absAmount,
  negateAmount,
  amountsEqual,
  isZero,
  isPositive,
  isNegative,
  compareAmounts,
  Amount,
} from "../../domain/money/amount";

describe("Amount", () => {
  describe("amountFromCents", () => {
    it("creates amount from valid cents", () => {
      const amount = amountFromCents(12345, "EUR");
      expect(amount.cents).toBe(12345);
      expect(amount.currency).toBe("EUR");
    });

    it("throws for non-integer cents", () => {
      expect(() => amountFromCents(123.45, "EUR")).toThrow();
    });

    it("allows negative cents", () => {
      const amount = amountFromCents(-500, "USD");
      expect(amount.cents).toBe(-500);
    });
  });

  describe("amountFromDecimal", () => {
    it("converts decimal to cents correctly", () => {
      const amount = amountFromDecimal(123.45, "EUR");
      expect(amount.cents).toBe(12345);
    });

    it("rounds using banker's rounding (half to even)", () => {
      // 0.5 -> rounds to even (0)
      expect(amountFromDecimal(0.005, "EUR").cents).toBe(0);
      // 1.5 -> rounds to even (2)
      expect(amountFromDecimal(0.015, "EUR").cents).toBe(2);
      // 2.5 -> rounds to even (2)
      expect(amountFromDecimal(0.025, "EUR").cents).toBe(2);
      // 3.5 -> rounds to even (4)
      expect(amountFromDecimal(0.035, "EUR").cents).toBe(4);
    });

    it("handles negative decimals", () => {
      const amount = amountFromDecimal(-99.99, "GBP");
      expect(amount.cents).toBe(-9999);
    });
  });

  describe("amountToDecimal", () => {
    it("converts cents back to decimal", () => {
      const amount = amountFromCents(12345, "EUR");
      expect(amountToDecimal(amount)).toBe(123.45);
    });

    it("is inverse of amountFromDecimal", () => {
      const original = 567.89;
      const amount = amountFromDecimal(original, "USD");
      expect(amountToDecimal(amount)).toBe(original);
    });
  });

  describe("addAmounts", () => {
    it("adds amounts of same currency", () => {
      const a = amountFromCents(100, "EUR");
      const b = amountFromCents(200, "EUR");
      const result = addAmounts(a, b);
      expect(result.cents).toBe(300);
      expect(result.currency).toBe("EUR");
    });

    it("throws for different currencies", () => {
      const a = amountFromCents(100, "EUR");
      const b = amountFromCents(200, "USD");
      expect(() => addAmounts(a, b)).toThrow("Currency mismatch");
    });
  });

  describe("subtractAmounts", () => {
    it("subtracts amounts correctly", () => {
      const a = amountFromCents(500, "EUR");
      const b = amountFromCents(200, "EUR");
      const result = subtractAmounts(a, b);
      expect(result.cents).toBe(300);
    });

    it("can produce negative result", () => {
      const a = amountFromCents(100, "EUR");
      const b = amountFromCents(500, "EUR");
      const result = subtractAmounts(a, b);
      expect(result.cents).toBe(-400);
    });
  });

  describe("multiplyAmount", () => {
    it("multiplies by integer", () => {
      const amount = amountFromCents(100, "EUR");
      const result = multiplyAmount(amount, 3);
      expect(result.cents).toBe(300);
    });

    it("multiplies by decimal with rounding", () => {
      const amount = amountFromCents(100, "EUR");
      // 100 * 0.21 = 21
      const result = multiplyAmount(amount, 0.21);
      expect(result.cents).toBe(21);
    });
  });

  describe("sumAmounts", () => {
    it("sums array of amounts", () => {
      const amounts = [
        amountFromCents(100, "EUR"),
        amountFromCents(200, "EUR"),
        amountFromCents(300, "EUR"),
      ];
      const result = sumAmounts(amounts);
      expect(result.cents).toBe(600);
    });

    it("throws for empty array", () => {
      expect(() => sumAmounts([])).toThrow();
    });

    it("throws for mixed currencies", () => {
      const amounts = [
        amountFromCents(100, "EUR"),
        amountFromCents(200, "USD"),
      ];
      expect(() => sumAmounts(amounts)).toThrow();
    });
  });

  describe("comparison functions", () => {
    it("absAmount returns absolute value", () => {
      const neg = amountFromCents(-500, "EUR");
      const abs = absAmount(neg);
      expect(abs.cents).toBe(500);
    });

    it("negateAmount negates", () => {
      const pos = amountFromCents(500, "EUR");
      const neg = negateAmount(pos);
      expect(neg.cents).toBe(-500);
    });

    it("amountsEqual checks equality", () => {
      const a = amountFromCents(100, "EUR");
      const b = amountFromCents(100, "EUR");
      const c = amountFromCents(100, "USD");
      expect(amountsEqual(a, b)).toBe(true);
      expect(amountsEqual(a, c)).toBe(false);
    });

    it("isZero/isPositive/isNegative work correctly", () => {
      expect(isZero(amountFromCents(0, "EUR"))).toBe(true);
      expect(isPositive(amountFromCents(100, "EUR"))).toBe(true);
      expect(isNegative(amountFromCents(-100, "EUR"))).toBe(true);
    });

    it("compareAmounts returns correct ordering", () => {
      const small = amountFromCents(100, "EUR");
      const large = amountFromCents(500, "EUR");
      expect(compareAmounts(small, large)).toBe(-1);
      expect(compareAmounts(large, small)).toBe(1);
      expect(compareAmounts(small, amountFromCents(100, "EUR"))).toBe(0);
    });
  });

  describe("determinism", () => {
    it("same inputs always produce same outputs", () => {
      const runs = 10;
      const results: Amount[] = [];

      for (let i = 0; i < runs; i++) {
        const a = amountFromDecimal(123.456789, "EUR");
        const b = amountFromDecimal(987.654321, "EUR");
        const result = addAmounts(a, b);
        results.push(result);
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].cents).toBe(results[0].cents);
      }
    });
  });
});
