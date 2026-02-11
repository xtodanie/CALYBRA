/**
 * Business Errors Tests - 100% coverage
 *
 * Tests for error taxonomy, creation, and type guards
 */

import {
  BusinessErrorCode,
  BusinessErrorCodeType,
  ErrorSeverity,
  ErrorCategory,
  BusinessError,
  ERROR_METADATA,
  createBusinessError,
  isBusinessError,
  getCategoryFromCode,
  isCritical,
  isUserActionable,
} from "../../../server/logic/errors/businessErrors";

describe("BusinessErrorCode", () => {
  it("should have unique codes for all error types", () => {
    const codes = Object.values(BusinessErrorCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("should have validation codes starting with V", () => {
    expect(BusinessErrorCode.INVALID_INPUT).toBe("V100");
    expect(BusinessErrorCode.MISSING_REQUIRED_FIELD).toBe("V101");
    expect(BusinessErrorCode.INVALID_VAT_RATE).toBe("V108");
  });

  it("should have calculation codes starting with C", () => {
    expect(BusinessErrorCode.CURRENCY_MISMATCH).toBe("C200");
    expect(BusinessErrorCode.OVERFLOW).toBe("C201");
    expect(BusinessErrorCode.DIVISION_BY_ZERO).toBe("C202");
  });

  it("should have reconciliation codes starting with R", () => {
    expect(BusinessErrorCode.BALANCE_MISMATCH).toBe("R300");
    expect(BusinessErrorCode.UNMATCHED_TRANSACTIONS).toBe("R301");
    expect(BusinessErrorCode.TOLERANCE_EXCEEDED).toBe("R303");
  });

  it("should have state codes starting with S", () => {
    expect(BusinessErrorCode.INVALID_STATUS_TRANSITION).toBe("S400");
    expect(BusinessErrorCode.PERIOD_FINALIZED).toBe("S401");
  });

  it("should have data codes starting with D", () => {
    expect(BusinessErrorCode.DATA_CORRUPTION).toBe("D500");
    expect(BusinessErrorCode.DUPLICATE_ENTRY).toBe("D504");
  });

  it("should have export codes starting with E", () => {
    expect(BusinessErrorCode.EXPORT_FAILED).toBe("E600");
    expect(BusinessErrorCode.NO_DATA_TO_EXPORT).toBe("E602");
  });

  it("should have internal codes starting with I", () => {
    expect(BusinessErrorCode.INTERNAL_ERROR).toBe("I900");
    expect(BusinessErrorCode.UNKNOWN_ERROR).toBe("I999");
  });
});

describe("ERROR_METADATA", () => {
  it("should have metadata for all error codes", () => {
    const allCodes = Object.values(BusinessErrorCode) as BusinessErrorCodeType[];
    for (const code of allCodes) {
      expect(ERROR_METADATA[code]).toBeDefined();
      expect(ERROR_METADATA[code].category).toBeDefined();
      expect(ERROR_METADATA[code].severity).toBeDefined();
      expect(ERROR_METADATA[code].defaultMessage).toBeDefined();
      expect(typeof ERROR_METADATA[code].recoverable).toBe("boolean");
      expect(typeof ERROR_METADATA[code].retryable).toBe("boolean");
    }
  });

  it("should have valid categories", () => {
    const validCategories = Object.values(ErrorCategory);
    for (const metadata of Object.values(ERROR_METADATA)) {
      expect(validCategories).toContain(metadata.category);
    }
  });

  it("should have valid severities", () => {
    const validSeverities = Object.values(ErrorSeverity);
    for (const metadata of Object.values(ERROR_METADATA)) {
      expect(validSeverities).toContain(metadata.severity);
    }
  });
});

describe("createBusinessError", () => {
  it("should create error with default message", () => {
    const error = createBusinessError(BusinessErrorCode.INVALID_INPUT);

    expect(error.code).toBe("V100");
    expect(error.message).toBe("Invalid input provided");
    expect(error.category).toBe("VALIDATION");
    expect(error.severity).toBe("WARNING");
    expect(error.recoverable).toBe(true);
    expect(error.retryable).toBe(false);
  });

  it("should create error with custom message", () => {
    const error = createBusinessError(BusinessErrorCode.INVALID_INPUT, {
      message: "Custom error message",
    });

    expect(error.message).toBe("Custom error message");
  });

  it("should create error with details", () => {
    const error = createBusinessError(BusinessErrorCode.CURRENCY_MISMATCH, {
      details: { expected: "EUR", actual: "USD" },
    });

    expect(error.details).toEqual({ expected: "EUR", actual: "USD" });
  });

  it("should create error with cause", () => {
    const error = createBusinessError(BusinessErrorCode.INTERNAL_ERROR, {
      cause: { code: "ORIGINAL", message: "Original error" },
    });

    expect(error.cause).toEqual({ code: "ORIGINAL", message: "Original error" });
  });

  it("should create critical error", () => {
    const error = createBusinessError(BusinessErrorCode.DATA_CORRUPTION);

    expect(error.severity).toBe("CRITICAL");
    expect(error.recoverable).toBe(false);
    expect(error.retryable).toBe(false);
  });

  it("should create retryable error", () => {
    const error = createBusinessError(BusinessErrorCode.CONCURRENT_MODIFICATION);

    expect(error.retryable).toBe(true);
  });
});

describe("isBusinessError", () => {
  it("should return true for valid BusinessError", () => {
    const error = createBusinessError(BusinessErrorCode.INVALID_INPUT);
    expect(isBusinessError(error)).toBe(true);
  });

  it("should return false for null", () => {
    expect(isBusinessError(null)).toBe(false);
  });

  it("should return false for undefined", () => {
    expect(isBusinessError(undefined)).toBe(false);
  });

  it("should return false for plain object", () => {
    expect(isBusinessError({ foo: "bar" })).toBe(false);
  });

  it("should return false for string", () => {
    expect(isBusinessError("error")).toBe(false);
  });

  it("should return false for Error instance", () => {
    expect(isBusinessError(new Error("test"))).toBe(false);
  });

  it("should return false for partial BusinessError", () => {
    expect(
      isBusinessError({
        code: "V100",
        message: "test",
        // missing other required fields
      })
    ).toBe(false);
  });

  it("should return true for manually constructed BusinessError", () => {
    const obj: BusinessError = {
      code: "V100",
      message: "test",
      category: "VALIDATION",
      severity: "WARNING",
      recoverable: true,
      retryable: false,
    };
    expect(isBusinessError(obj)).toBe(true);
  });
});

describe("getCategoryFromCode", () => {
  it("should return VALIDATION for validation codes", () => {
    expect(getCategoryFromCode(BusinessErrorCode.INVALID_INPUT)).toBe("VALIDATION");
    expect(getCategoryFromCode(BusinessErrorCode.INVALID_VAT_RATE)).toBe("VALIDATION");
  });

  it("should return CALCULATION for calculation codes", () => {
    expect(getCategoryFromCode(BusinessErrorCode.CURRENCY_MISMATCH)).toBe("CALCULATION");
    expect(getCategoryFromCode(BusinessErrorCode.OVERFLOW)).toBe("CALCULATION");
  });

  it("should return RECONCILIATION for reconciliation codes", () => {
    expect(getCategoryFromCode(BusinessErrorCode.BALANCE_MISMATCH)).toBe("RECONCILIATION");
  });

  it("should return INTERNAL for internal codes", () => {
    expect(getCategoryFromCode(BusinessErrorCode.UNKNOWN_ERROR)).toBe("INTERNAL");
  });
});

describe("isCritical", () => {
  it("should return true for critical errors", () => {
    expect(isCritical(BusinessErrorCode.DATA_CORRUPTION)).toBe(true);
    expect(isCritical(BusinessErrorCode.INTERNAL_ERROR)).toBe(true);
  });

  it("should return false for non-critical errors", () => {
    expect(isCritical(BusinessErrorCode.INVALID_INPUT)).toBe(false);
    expect(isCritical(BusinessErrorCode.BALANCE_MISMATCH)).toBe(false);
  });
});

describe("isUserActionable", () => {
  it("should return true for recoverable errors", () => {
    const error = createBusinessError(BusinessErrorCode.INVALID_INPUT);
    expect(isUserActionable(error)).toBe(true);
  });

  it("should return true for retryable errors", () => {
    const error = createBusinessError(BusinessErrorCode.CONCURRENT_MODIFICATION);
    expect(isUserActionable(error)).toBe(true);
  });

  it("should return false for non-actionable errors", () => {
    const error = createBusinessError(BusinessErrorCode.DATA_CORRUPTION);
    expect(isUserActionable(error)).toBe(false);
  });
});
