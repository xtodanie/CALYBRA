/**
 * Normalize Error Tests - 100% coverage
 *
 * Tests for error normalization, sanitization, and Result type utilities
 */

import {
  normalizeError,
  ok,
  err,
  errFromCode,
  tryCatch,
  tryCatchAsync,
} from "../../../server/logic/errors/normalizeError";
import {
  BusinessErrorCode,
  createBusinessError,
  isBusinessError,
} from "../../../server/logic/errors/businessErrors";

describe("normalizeError", () => {
  describe("with BusinessError input", () => {
    it("should return BusinessError unchanged", () => {
      const original = createBusinessError(BusinessErrorCode.INVALID_INPUT, {
        message: "Test error",
      });
      const normalized = normalizeError(original);
      expect(normalized).toBe(original);
    });
  });

  describe("with Error input", () => {
    it("should normalize Error to BusinessError", () => {
      const error = new Error("Something went wrong");
      const normalized = normalizeError(error);

      expect(isBusinessError(normalized)).toBe(true);
      expect(normalized.message).toBe("Something went wrong");
      expect(normalized.cause?.code).toBe("Error");
    });

    it("should infer currency mismatch code", () => {
      const error = new Error("Currency mismatch: EUR vs USD");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.CURRENCY_MISMATCH);
    });

    it("should infer invalid date code", () => {
      const error = new Error("Invalid date format: abc");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.INVALID_DATE_FORMAT);
    });

    it("should infer VAT rate code", () => {
      const error = new Error("Invalid VAT rate: 150");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.INVALID_VAT_RATE);
    });

    it("should infer missing required field code", () => {
      const error = new Error("Field 'name' must not be empty");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.MISSING_REQUIRED_FIELD);
    });

    it("should infer overflow code from safe integer message", () => {
      const error = new Error("Amount cents must be a safe integer");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.OVERFLOW);
    });

    it("should infer empty collection code", () => {
      const error = new Error("Cannot sum empty amount array");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.EMPTY_COLLECTION);
    });

    it("should default to UNKNOWN_ERROR for unmatched patterns", () => {
      const error = new Error("Some random error");
      const normalized = normalizeError(error);

      expect(normalized.code).toBe(BusinessErrorCode.UNKNOWN_ERROR);
    });
  });

  describe("with string input", () => {
    it("should normalize string to BusinessError", () => {
      const normalized = normalizeError("Something went wrong");

      expect(isBusinessError(normalized)).toBe(true);
      expect(normalized.message).toBe("Something went wrong");
    });

    it("should infer code from string message", () => {
      const normalized = normalizeError("Currency mismatch detected");
      expect(normalized.code).toBe(BusinessErrorCode.CURRENCY_MISMATCH);
    });
  });

  describe("with object input", () => {
    it("should normalize plain object with message", () => {
      const normalized = normalizeError({ message: "Test error" });

      expect(isBusinessError(normalized)).toBe(true);
      expect(normalized.message).toBe("Test error");
    });

    it("should normalize object with error property", () => {
      const normalized = normalizeError({ error: "Test error" });

      expect(normalized.message).toBe("Test error");
    });

    it("should extract primitive details", () => {
      const normalized = normalizeError({
        message: "Test error",
        field: "name",
        count: 5,
        valid: false,
      });

      expect(normalized.details).toEqual({
        field: "name",
        count: 5,
        valid: false,
      });
    });

    it("should not include non-primitive details", () => {
      const normalized = normalizeError({
        message: "Test error",
        nested: { foo: "bar" },
        array: [1, 2, 3],
      });

      expect(normalized.details).toBeUndefined();
    });

    it("should use valid code from object", () => {
      const normalized = normalizeError({
        code: BusinessErrorCode.INVALID_INPUT,
        message: "Test",
      });

      expect(normalized.code).toBe(BusinessErrorCode.INVALID_INPUT);
    });
  });

  describe("with primitive input", () => {
    it("should normalize number to UNKNOWN_ERROR", () => {
      const normalized = normalizeError(42);

      expect(normalized.code).toBe(BusinessErrorCode.UNKNOWN_ERROR);
      expect(normalized.details?.originalType).toBe("number");
    });

    it("should normalize boolean to UNKNOWN_ERROR", () => {
      const normalized = normalizeError(false);

      expect(normalized.code).toBe(BusinessErrorCode.UNKNOWN_ERROR);
    });

    it("should normalize undefined to UNKNOWN_ERROR", () => {
      const normalized = normalizeError(undefined);

      expect(normalized.code).toBe(BusinessErrorCode.UNKNOWN_ERROR);
    });
  });

  describe("message sanitization", () => {
    it("should redact email addresses", () => {
      const error = new Error("Error for user test@example.com");
      const normalized = normalizeError(error);

      expect(normalized.message).not.toContain("test@example.com");
      expect(normalized.message).toContain("[REDACTED]");
    });

    it("should redact potential passwords", () => {
      const error = new Error("password: secret123");
      const normalized = normalizeError(error);

      expect(normalized.message).not.toContain("secret123");
    });

    it("should redact stack trace lines", () => {
      const error = new Error("Error occurred");
      error.stack = `Error: test\n    at Function.run (/app/src/index.js:10:5)\n    at main (/app/src/main.js:20:10)`;

      // The message should not contain stack trace
      const normalized = normalizeError(error.message + "\n" + error.stack);
      expect(normalized.message).toContain("[REDACTED]");
    });

    it("should truncate very long messages", () => {
      const longMessage = "x".repeat(1000);
      const normalized = normalizeError(longMessage);

      expect(normalized.message.length).toBeLessThanOrEqual(503); // 500 + "..."
    });
  });
});

describe("Result type utilities", () => {
  describe("ok", () => {
    it("should create successful result", () => {
      const result = ok(42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("should work with complex types", () => {
      const result = ok({ name: "test", value: 123 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual({ name: "test", value: 123 });
      }
    });
  });

  describe("err", () => {
    it("should create failed result", () => {
      const error = createBusinessError(BusinessErrorCode.INVALID_INPUT);
      const result = err<number>(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe("errFromCode", () => {
    it("should create failed result from code", () => {
      const result = errFromCode<number>(BusinessErrorCode.INVALID_INPUT);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(BusinessErrorCode.INVALID_INPUT);
      }
    });

    it("should accept custom message", () => {
      const result = errFromCode<number>(BusinessErrorCode.INVALID_INPUT, {
        message: "Custom message",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Custom message");
      }
    });

    it("should accept details", () => {
      const result = errFromCode<number>(BusinessErrorCode.INVALID_INPUT, {
        details: { field: "test" },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.details).toEqual({ field: "test" });
      }
    });
  });

  describe("tryCatch", () => {
    it("should return ok for successful function", () => {
      const result = tryCatch(() => 42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("should return err for throwing function", () => {
      const result = tryCatch(() => {
        throw new Error("Test error");
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Test error");
      }
    });

    it("should normalize thrown error", () => {
      const result = tryCatch(() => {
        throw "string error";
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(isBusinessError(result.error)).toBe(true);
      }
    });
  });

  describe("tryCatchAsync", () => {
    it("should return ok for successful async function", async () => {
      const result = await tryCatchAsync(async () => 42);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("should return err for rejected async function", async () => {
      const result = await tryCatchAsync(async () => {
        throw new Error("Async error");
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Async error");
      }
    });

    it("should handle Promise.reject", async () => {
      const result = await tryCatchAsync(() => Promise.reject(new Error("Rejected")));

      expect(result.success).toBe(false);
    });
  });
});

describe("pattern matching coverage", () => {
  const patterns = [
    { input: "unsupported currency XYZ", expected: BusinessErrorCode.INVALID_CURRENCY },
    { input: "invalid currency code", expected: BusinessErrorCode.INVALID_CURRENCY },
    { input: "negative amount not allowed", expected: BusinessErrorCode.NEGATIVE_AMOUNT_NOT_ALLOWED },
    { input: "invalid amount value", expected: BusinessErrorCode.INVALID_AMOUNT },
    { input: "expected YYYY-MM-DD format", expected: BusinessErrorCode.INVALID_DATE_FORMAT },
    { input: "is required", expected: BusinessErrorCode.MISSING_REQUIRED_FIELD },
    { input: "value out of range", expected: BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { input: "between 0 and 100", expected: BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { input: "confidence score invalid", expected: BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { input: "period is finalized", expected: BusinessErrorCode.PERIOD_FINALIZED },
    { input: "resource is locked", expected: BusinessErrorCode.PERIOD_LOCKED },
    { input: "invalid status transition", expected: BusinessErrorCode.INVALID_STATUS_TRANSITION },
    { input: "operation not allowed", expected: BusinessErrorCode.OPERATION_NOT_ALLOWED },
    { input: "tolerance limit exceeded", expected: BusinessErrorCode.TOLERANCE_EXCEEDED },
    { input: "balance does not match", expected: BusinessErrorCode.BALANCE_MISMATCH },
    { input: "unmatched bank transaction", expected: BusinessErrorCode.UNMATCHED_TRANSACTIONS },
    { input: "unmatched invoice found", expected: BusinessErrorCode.UNMATCHED_INVOICES },
    { input: "duplicate match detected", expected: BusinessErrorCode.DUPLICATE_MATCH },
    { input: "entity not found", expected: BusinessErrorCode.REFERENCE_NOT_FOUND },
    { input: "duplicate entry exists", expected: BusinessErrorCode.DUPLICATE_ENTRY },
    { input: "data integrity check failed", expected: BusinessErrorCode.INTEGRITY_VIOLATION },
    { input: "schema version mismatch", expected: BusinessErrorCode.SCHEMA_MISMATCH },
    { input: "cannot divide by zero", expected: BusinessErrorCode.DIVISION_BY_ZERO },
    { input: "integer overflow detected", expected: BusinessErrorCode.OVERFLOW },
    { input: "precision loss warning", expected: BusinessErrorCode.PRECISION_LOSS },
    { input: "rounding error occurred", expected: BusinessErrorCode.ROUNDING_ERROR },
    { input: "export operation failed", expected: BusinessErrorCode.EXPORT_FAILED },
    { input: "no data available to export", expected: BusinessErrorCode.NO_DATA_TO_EXPORT },
    { input: "export file size exceeded", expected: BusinessErrorCode.EXPORT_SIZE_EXCEEDED },
    { input: "invalid format detected", expected: BusinessErrorCode.INVALID_FORMAT },
    { input: "invalid invoice number", expected: BusinessErrorCode.INVALID_INVOICE_NUMBER },
  ];

  it.each(patterns)("should infer $expected from '$input'", ({ input, expected }) => {
    const normalized = normalizeError(input);
    expect(normalized.code).toBe(expected);
  });
});
