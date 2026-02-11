/**
 * Error Normalization - Converts arbitrary errors to BusinessErrors
 * Pure logic. No IO, no randomness, no time.
 *
 * INVARIANT: All errors are normalized to BusinessError
 * INVARIANT: No PII or sensitive data in normalized errors
 * INVARIANT: Stack traces are never exposed in message
 *
 * @module errors/normalizeError
 */

import {
  BusinessError,
  BusinessErrorCode,
  BusinessErrorCodeType,
  createBusinessError,
  isBusinessError,
} from "./businessErrors";

// ============================================================================
// ERROR MESSAGE PATTERNS
// ============================================================================

/**
 * Pattern matchers for known error types
 */
interface ErrorPattern {
  readonly pattern: RegExp;
  readonly code: BusinessErrorCodeType;
}

/**
 * Known error patterns mapped to business error codes
 * Order matters: more specific patterns should come first
 */
const ERROR_PATTERNS: readonly ErrorPattern[] = [
  // Currency errors
  { pattern: /currency mismatch/i, code: BusinessErrorCode.CURRENCY_MISMATCH },
  { pattern: /unsupported currency/i, code: BusinessErrorCode.INVALID_CURRENCY },
  { pattern: /invalid currency/i, code: BusinessErrorCode.INVALID_CURRENCY },

  // Amount errors
  { pattern: /safe integer/i, code: BusinessErrorCode.OVERFLOW },
  { pattern: /cannot sum empty/i, code: BusinessErrorCode.EMPTY_COLLECTION },
  { pattern: /invalid vat rate/i, code: BusinessErrorCode.INVALID_VAT_RATE },
  { pattern: /vat rate/i, code: BusinessErrorCode.INVALID_VAT_RATE },
  { pattern: /negative amount/i, code: BusinessErrorCode.NEGATIVE_AMOUNT_NOT_ALLOWED },
  { pattern: /invalid amount/i, code: BusinessErrorCode.INVALID_AMOUNT },

  // Date errors
  { pattern: /invalid date/i, code: BusinessErrorCode.INVALID_DATE_FORMAT },
  { pattern: /date format/i, code: BusinessErrorCode.INVALID_DATE_FORMAT },
  { pattern: /yyyy-mm-dd/i, code: BusinessErrorCode.INVALID_DATE_FORMAT },

  // Validation errors
  { pattern: /must not be empty/i, code: BusinessErrorCode.MISSING_REQUIRED_FIELD },
  { pattern: /required/i, code: BusinessErrorCode.MISSING_REQUIRED_FIELD },
  { pattern: /out of range/i, code: BusinessErrorCode.VALUE_OUT_OF_RANGE },
  { pattern: /between 0 and 100/i, code: BusinessErrorCode.VALUE_OUT_OF_RANGE },
  { pattern: /confidence/i, code: BusinessErrorCode.VALUE_OUT_OF_RANGE },
  { pattern: /invalid format/i, code: BusinessErrorCode.INVALID_FORMAT },
  { pattern: /invalid invoice number/i, code: BusinessErrorCode.INVALID_INVOICE_NUMBER },

  // State errors
  { pattern: /finalized/i, code: BusinessErrorCode.PERIOD_FINALIZED },
  { pattern: /locked/i, code: BusinessErrorCode.PERIOD_LOCKED },
  { pattern: /invalid.*transition/i, code: BusinessErrorCode.INVALID_STATUS_TRANSITION },
  { pattern: /not allowed/i, code: BusinessErrorCode.OPERATION_NOT_ALLOWED },

  // Reconciliation errors
  { pattern: /tolerance.*exceeded/i, code: BusinessErrorCode.TOLERANCE_EXCEEDED },
  { pattern: /balance.*(mismatch|not match|does not match)/i, code: BusinessErrorCode.BALANCE_MISMATCH },
  { pattern: /unmatched.*transaction/i, code: BusinessErrorCode.UNMATCHED_TRANSACTIONS },
  { pattern: /unmatched.*invoice/i, code: BusinessErrorCode.UNMATCHED_INVOICES },
  { pattern: /duplicate.*match/i, code: BusinessErrorCode.DUPLICATE_MATCH },

  // Data errors
  { pattern: /not found/i, code: BusinessErrorCode.REFERENCE_NOT_FOUND },
  { pattern: /duplicate/i, code: BusinessErrorCode.DUPLICATE_ENTRY },
  { pattern: /integrity/i, code: BusinessErrorCode.INTEGRITY_VIOLATION },
  { pattern: /schema/i, code: BusinessErrorCode.SCHEMA_MISMATCH },

  // Calculation errors
  { pattern: /divide.*zero/i, code: BusinessErrorCode.DIVISION_BY_ZERO },
  { pattern: /overflow/i, code: BusinessErrorCode.OVERFLOW },
  { pattern: /precision/i, code: BusinessErrorCode.PRECISION_LOSS },
  { pattern: /rounding/i, code: BusinessErrorCode.ROUNDING_ERROR },

  // Export errors
  { pattern: /export.*fail/i, code: BusinessErrorCode.EXPORT_FAILED },
  { pattern: /no data.*export/i, code: BusinessErrorCode.NO_DATA_TO_EXPORT },
  { pattern: /export.*size/i, code: BusinessErrorCode.EXPORT_SIZE_EXCEEDED },
];

// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================

/**
 * Patterns that indicate sensitive data that should be redacted
 */
const SENSITIVE_PATTERNS: readonly RegExp[] = [
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, // Email
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, // Credit card
  /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, // SSN
  /\bpassword\s*[:=]\s*\S+/gi, // Password in text
  /\btoken\s*[:=]\s*\S+/gi, // Token in text
  /\bapi[_-]?key\s*[:=]\s*\S+/gi, // API key in text
  /\bsecret\s*[:=]\s*\S+/gi, // Secret in text
  /at\s+[\w.]+\s+\([^)]+:\d+:\d+\)/g, // Stack trace lines
  /^\s*at\s+.+$/gm, // Stack trace "at" lines
];

// ============================================================================
// NORMALIZATION FUNCTIONS
// ============================================================================

/**
 * Normalizes any error to a BusinessError
 *
 * @param error - Any error value (Error, string, object, etc.)
 * @returns Normalized BusinessError
 */
export function normalizeError(error: unknown): BusinessError {
  // Already a BusinessError
  if (isBusinessError(error)) {
    return error;
  }

  // Error object
  if (error instanceof Error) {
    return normalizeErrorObject(error);
  }

  // String message
  if (typeof error === "string") {
    return normalizeStringError(error);
  }

  // Object with message
  if (typeof error === "object" && error !== null) {
    return normalizeObjectError(error as Record<string, unknown>);
  }

  // Fallback for primitives
  return createBusinessError(BusinessErrorCode.UNKNOWN_ERROR, {
    message: "An unknown error occurred",
    details: {
      originalType: typeof error,
    },
  });
}

/**
 * Normalizes an Error object
 */
function normalizeErrorObject(error: Error): BusinessError {
  const sanitizedMessage = sanitizeMessage(error.message);
  const code = inferCodeFromMessage(error.message);

  return createBusinessError(code, {
    message: sanitizedMessage,
    cause: {
      code: error.name,
      message: sanitizedMessage,
    },
  });
}

/**
 * Normalizes a string error
 */
function normalizeStringError(message: string): BusinessError {
  const sanitizedMessage = sanitizeMessage(message);
  const code = inferCodeFromMessage(message);

  return createBusinessError(code, {
    message: sanitizedMessage,
  });
}

/**
 * Normalizes an object error
 */
function normalizeObjectError(obj: Record<string, unknown>): BusinessError {
  // Try to extract common error properties
  const message =
    typeof obj.message === "string"
      ? obj.message
      : typeof obj.error === "string"
        ? obj.error
        : "An error occurred";

  const sanitizedMessage = sanitizeMessage(message);
  const code =
    typeof obj.code === "string" && isValidCode(obj.code)
      ? (obj.code as BusinessErrorCodeType)
      : inferCodeFromMessage(message);

  const details: Record<string, string | number | boolean> = {};

  // Safely extract primitive details
  for (const [key, value] of Object.entries(obj)) {
    if (
      key !== "message" &&
      key !== "stack" &&
      key !== "code" &&
      (typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean")
    ) {
      const sanitizedValue =
        typeof value === "string" ? sanitizeMessage(value) : value;
      details[key] = sanitizedValue;
    }
  }

  return createBusinessError(code, {
    message: sanitizedMessage,
    details: Object.keys(details).length > 0 ? details : undefined,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Infers an error code from a message
 */
function inferCodeFromMessage(message: string): BusinessErrorCodeType {
  for (const { pattern, code } of ERROR_PATTERNS) {
    if (pattern.test(message)) {
      return code;
    }
  }
  return BusinessErrorCode.UNKNOWN_ERROR;
}

/**
 * Sanitizes an error message by removing sensitive data
 */
function sanitizeMessage(message: string): string {
  let sanitized = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  // Truncate very long messages
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + "...";
  }

  // Remove any remaining potential stack trace indicators
  if (sanitized.includes("[REDACTED]")) {
    // Clean up multiple consecutive redactions
    sanitized = sanitized.replace(/(\[REDACTED\]\s*)+/g, "[REDACTED] ");
  }

  return sanitized.trim();
}

/**
 * Checks if a string is a valid BusinessErrorCodeType
 */
function isValidCode(code: string): boolean {
  return Object.values(BusinessErrorCode).includes(
    code as BusinessErrorCodeType
  );
}

// ============================================================================
// RESULT TYPE
// ============================================================================

/**
 * Result type for operations that can fail
 */
export type Result<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: BusinessError };

/**
 * Creates a successful result
 */
export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

/**
 * Creates a failed result from an error
 */
export function err<T>(error: BusinessError): Result<T> {
  return { success: false, error };
}

/**
 * Creates a failed result from an error code
 */
export function errFromCode<T>(
  code: BusinessErrorCodeType,
  options?: {
    message?: string;
    details?: Record<string, string | number | boolean>;
  }
): Result<T> {
  return { success: false, error: createBusinessError(code, options) };
}

/**
 * Wraps a function that might throw, returning a Result
 */
export function tryCatch<T>(fn: () => T): Result<T> {
  try {
    return ok(fn());
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}

/**
 * Wraps an async function that might throw, returning a Result
 */
export async function tryCatchAsync<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    return { success: false, error: normalizeError(error) };
  }
}
