"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeError = normalizeError;
exports.ok = ok;
exports.err = err;
exports.errFromCode = errFromCode;
exports.tryCatch = tryCatch;
exports.tryCatchAsync = tryCatchAsync;
const businessErrors_1 = require("./businessErrors");
/**
 * Known error patterns mapped to business error codes
 * Order matters: more specific patterns should come first
 */
const ERROR_PATTERNS = [
    // Currency errors
    { pattern: /currency mismatch/i, code: businessErrors_1.BusinessErrorCode.CURRENCY_MISMATCH },
    { pattern: /unsupported currency/i, code: businessErrors_1.BusinessErrorCode.INVALID_CURRENCY },
    { pattern: /invalid currency/i, code: businessErrors_1.BusinessErrorCode.INVALID_CURRENCY },
    // Amount errors
    { pattern: /safe integer/i, code: businessErrors_1.BusinessErrorCode.OVERFLOW },
    { pattern: /cannot sum empty/i, code: businessErrors_1.BusinessErrorCode.EMPTY_COLLECTION },
    { pattern: /invalid vat rate/i, code: businessErrors_1.BusinessErrorCode.INVALID_VAT_RATE },
    { pattern: /vat rate/i, code: businessErrors_1.BusinessErrorCode.INVALID_VAT_RATE },
    { pattern: /negative amount/i, code: businessErrors_1.BusinessErrorCode.NEGATIVE_AMOUNT_NOT_ALLOWED },
    { pattern: /invalid amount/i, code: businessErrors_1.BusinessErrorCode.INVALID_AMOUNT },
    // Date errors
    { pattern: /invalid date/i, code: businessErrors_1.BusinessErrorCode.INVALID_DATE_FORMAT },
    { pattern: /date format/i, code: businessErrors_1.BusinessErrorCode.INVALID_DATE_FORMAT },
    { pattern: /yyyy-mm-dd/i, code: businessErrors_1.BusinessErrorCode.INVALID_DATE_FORMAT },
    // Validation errors
    { pattern: /must not be empty/i, code: businessErrors_1.BusinessErrorCode.MISSING_REQUIRED_FIELD },
    { pattern: /required/i, code: businessErrors_1.BusinessErrorCode.MISSING_REQUIRED_FIELD },
    { pattern: /out of range/i, code: businessErrors_1.BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { pattern: /between 0 and 100/i, code: businessErrors_1.BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { pattern: /confidence/i, code: businessErrors_1.BusinessErrorCode.VALUE_OUT_OF_RANGE },
    { pattern: /invalid format/i, code: businessErrors_1.BusinessErrorCode.INVALID_FORMAT },
    { pattern: /invalid invoice number/i, code: businessErrors_1.BusinessErrorCode.INVALID_INVOICE_NUMBER },
    // State errors
    { pattern: /finalized/i, code: businessErrors_1.BusinessErrorCode.PERIOD_FINALIZED },
    { pattern: /locked/i, code: businessErrors_1.BusinessErrorCode.PERIOD_LOCKED },
    { pattern: /invalid.*transition/i, code: businessErrors_1.BusinessErrorCode.INVALID_STATUS_TRANSITION },
    { pattern: /not allowed/i, code: businessErrors_1.BusinessErrorCode.OPERATION_NOT_ALLOWED },
    // Reconciliation errors
    { pattern: /tolerance.*exceeded/i, code: businessErrors_1.BusinessErrorCode.TOLERANCE_EXCEEDED },
    { pattern: /balance.*(mismatch|not match|does not match)/i, code: businessErrors_1.BusinessErrorCode.BALANCE_MISMATCH },
    { pattern: /unmatched.*transaction/i, code: businessErrors_1.BusinessErrorCode.UNMATCHED_TRANSACTIONS },
    { pattern: /unmatched.*invoice/i, code: businessErrors_1.BusinessErrorCode.UNMATCHED_INVOICES },
    { pattern: /duplicate.*match/i, code: businessErrors_1.BusinessErrorCode.DUPLICATE_MATCH },
    // Data errors
    { pattern: /not found/i, code: businessErrors_1.BusinessErrorCode.REFERENCE_NOT_FOUND },
    { pattern: /duplicate/i, code: businessErrors_1.BusinessErrorCode.DUPLICATE_ENTRY },
    { pattern: /integrity/i, code: businessErrors_1.BusinessErrorCode.INTEGRITY_VIOLATION },
    { pattern: /schema/i, code: businessErrors_1.BusinessErrorCode.SCHEMA_MISMATCH },
    // Calculation errors
    { pattern: /divide.*zero/i, code: businessErrors_1.BusinessErrorCode.DIVISION_BY_ZERO },
    { pattern: /overflow/i, code: businessErrors_1.BusinessErrorCode.OVERFLOW },
    { pattern: /precision/i, code: businessErrors_1.BusinessErrorCode.PRECISION_LOSS },
    { pattern: /rounding/i, code: businessErrors_1.BusinessErrorCode.ROUNDING_ERROR },
    // Export errors
    { pattern: /export.*fail/i, code: businessErrors_1.BusinessErrorCode.EXPORT_FAILED },
    { pattern: /no data.*export/i, code: businessErrors_1.BusinessErrorCode.NO_DATA_TO_EXPORT },
    { pattern: /export.*size/i, code: businessErrors_1.BusinessErrorCode.EXPORT_SIZE_EXCEEDED },
];
// ============================================================================
// SENSITIVE DATA PATTERNS
// ============================================================================
/**
 * Patterns that indicate sensitive data that should be redacted
 */
const SENSITIVE_PATTERNS = [
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
function normalizeError(error) {
    // Already a BusinessError
    if ((0, businessErrors_1.isBusinessError)(error)) {
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
        return normalizeObjectError(error);
    }
    // Fallback for primitives
    return (0, businessErrors_1.createBusinessError)(businessErrors_1.BusinessErrorCode.UNKNOWN_ERROR, {
        message: "An unknown error occurred",
        details: {
            originalType: typeof error,
        },
    });
}
/**
 * Normalizes an Error object
 */
function normalizeErrorObject(error) {
    const sanitizedMessage = sanitizeMessage(error.message);
    const code = inferCodeFromMessage(error.message);
    return (0, businessErrors_1.createBusinessError)(code, {
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
function normalizeStringError(message) {
    const sanitizedMessage = sanitizeMessage(message);
    const code = inferCodeFromMessage(message);
    return (0, businessErrors_1.createBusinessError)(code, {
        message: sanitizedMessage,
    });
}
/**
 * Normalizes an object error
 */
function normalizeObjectError(obj) {
    // Try to extract common error properties
    const message = typeof obj.message === "string"
        ? obj.message
        : typeof obj.error === "string"
            ? obj.error
            : "An error occurred";
    const sanitizedMessage = sanitizeMessage(message);
    const code = typeof obj.code === "string" && isValidCode(obj.code)
        ? obj.code
        : inferCodeFromMessage(message);
    const details = {};
    // Safely extract primitive details
    for (const [key, value] of Object.entries(obj)) {
        if (key !== "message" &&
            key !== "stack" &&
            key !== "code" &&
            (typeof value === "string" ||
                typeof value === "number" ||
                typeof value === "boolean")) {
            const sanitizedValue = typeof value === "string" ? sanitizeMessage(value) : value;
            details[key] = sanitizedValue;
        }
    }
    return (0, businessErrors_1.createBusinessError)(code, {
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
function inferCodeFromMessage(message) {
    for (const { pattern, code } of ERROR_PATTERNS) {
        if (pattern.test(message)) {
            return code;
        }
    }
    return businessErrors_1.BusinessErrorCode.UNKNOWN_ERROR;
}
/**
 * Sanitizes an error message by removing sensitive data
 */
function sanitizeMessage(message) {
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
function isValidCode(code) {
    return Object.values(businessErrors_1.BusinessErrorCode).includes(code);
}
/**
 * Creates a successful result
 */
function ok(value) {
    return { success: true, value };
}
/**
 * Creates a failed result from an error
 */
function err(error) {
    return { success: false, error };
}
/**
 * Creates a failed result from an error code
 */
function errFromCode(code, options) {
    return { success: false, error: (0, businessErrors_1.createBusinessError)(code, options) };
}
/**
 * Wraps a function that might throw, returning a Result
 */
function tryCatch(fn) {
    try {
        return ok(fn());
    }
    catch (error) {
        return { success: false, error: normalizeError(error) };
    }
}
/**
 * Wraps an async function that might throw, returning a Result
 */
async function tryCatchAsync(fn) {
    try {
        const value = await fn();
        return ok(value);
    }
    catch (error) {
        return { success: false, error: normalizeError(error) };
    }
}
//# sourceMappingURL=normalizeError.js.map