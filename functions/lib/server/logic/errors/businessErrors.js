"use strict";
/**
 * Business Error Taxonomy - Comprehensive error classification for CALYBRA
 * Pure types and constants. No IO, no randomness, no time.
 *
 * INVARIANT: All errors are deterministically classified
 * INVARIANT: Error messages are UX-safe (no PII, no stack traces)
 * INVARIANT: Every error has a defined recovery path
 *
 * @module errors/businessErrors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERROR_METADATA = exports.ErrorCategory = exports.ErrorSeverity = exports.BusinessErrorCode = void 0;
exports.createBusinessError = createBusinessError;
exports.isBusinessError = isBusinessError;
exports.getCategoryFromCode = getCategoryFromCode;
exports.isCritical = isCritical;
exports.isUserActionable = isUserActionable;
// ============================================================================
// ERROR CODES BY DOMAIN
// ============================================================================
/**
 * Error code categories for structured error handling
 */
exports.BusinessErrorCode = {
    // -------------------------------------------------------------------------
    // VALIDATION ERRORS (V1xx) - Input validation failures
    // -------------------------------------------------------------------------
    INVALID_INPUT: "V100",
    MISSING_REQUIRED_FIELD: "V101",
    INVALID_FORMAT: "V102",
    VALUE_OUT_OF_RANGE: "V103",
    INVALID_DATE_FORMAT: "V104",
    INVALID_CURRENCY: "V105",
    INVALID_AMOUNT: "V106",
    INVALID_INVOICE_NUMBER: "V107",
    INVALID_VAT_RATE: "V108",
    INVALID_PERIOD: "V109",
    EMPTY_COLLECTION: "V110",
    // -------------------------------------------------------------------------
    // CALCULATION ERRORS (C2xx) - Computation failures
    // -------------------------------------------------------------------------
    CURRENCY_MISMATCH: "C200",
    OVERFLOW: "C201",
    DIVISION_BY_ZERO: "C202",
    PRECISION_LOSS: "C203",
    ROUNDING_ERROR: "C204",
    NEGATIVE_AMOUNT_NOT_ALLOWED: "C205",
    CALCULATION_FAILED: "C206",
    // -------------------------------------------------------------------------
    // RECONCILIATION ERRORS (R3xx) - Matching and reconciliation failures
    // -------------------------------------------------------------------------
    BALANCE_MISMATCH: "R300",
    UNMATCHED_TRANSACTIONS: "R301",
    UNMATCHED_INVOICES: "R302",
    TOLERANCE_EXCEEDED: "R303",
    DUPLICATE_MATCH: "R304",
    MATCH_NOT_FOUND: "R305",
    RECONCILIATION_INCOMPLETE: "R306",
    PERIOD_NOT_READY: "R307",
    // -------------------------------------------------------------------------
    // STATE ERRORS (S4xx) - Invalid state transitions
    // -------------------------------------------------------------------------
    INVALID_STATUS_TRANSITION: "S400",
    PERIOD_FINALIZED: "S401",
    PERIOD_LOCKED: "S402",
    OPERATION_NOT_ALLOWED: "S403",
    CONCURRENT_MODIFICATION: "S404",
    // -------------------------------------------------------------------------
    // DATA ERRORS (D5xx) - Data integrity issues
    // -------------------------------------------------------------------------
    DATA_CORRUPTION: "D500",
    SCHEMA_MISMATCH: "D501",
    INTEGRITY_VIOLATION: "D502",
    REFERENCE_NOT_FOUND: "D503",
    DUPLICATE_ENTRY: "D504",
    // -------------------------------------------------------------------------
    // EXPORT ERRORS (E6xx) - Export/report generation failures
    // -------------------------------------------------------------------------
    EXPORT_FAILED: "E600",
    INVALID_EXPORT_FORMAT: "E601",
    NO_DATA_TO_EXPORT: "E602",
    EXPORT_SIZE_EXCEEDED: "E603",
    // -------------------------------------------------------------------------
    // INTERNAL ERRORS (I9xx) - Unexpected system errors
    // -------------------------------------------------------------------------
    INTERNAL_ERROR: "I900",
    UNKNOWN_ERROR: "I999",
};
// ============================================================================
// ERROR SEVERITY
// ============================================================================
exports.ErrorSeverity = {
    INFO: "INFO",
    WARNING: "WARNING",
    ERROR: "ERROR",
    CRITICAL: "CRITICAL",
};
// ============================================================================
// ERROR CATEGORY
// ============================================================================
exports.ErrorCategory = {
    VALIDATION: "VALIDATION",
    CALCULATION: "CALCULATION",
    RECONCILIATION: "RECONCILIATION",
    STATE: "STATE",
    DATA: "DATA",
    EXPORT: "EXPORT",
    INTERNAL: "INTERNAL",
};
/**
 * Complete error metadata mapping
 */
exports.ERROR_METADATA = {
    // Validation errors
    [exports.BusinessErrorCode.INVALID_INPUT]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid input provided",
    },
    [exports.BusinessErrorCode.MISSING_REQUIRED_FIELD]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "A required field is missing",
    },
    [exports.BusinessErrorCode.INVALID_FORMAT]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid format",
    },
    [exports.BusinessErrorCode.VALUE_OUT_OF_RANGE]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Value is out of acceptable range",
    },
    [exports.BusinessErrorCode.INVALID_DATE_FORMAT]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid date format. Use YYYY-MM-DD",
    },
    [exports.BusinessErrorCode.INVALID_CURRENCY]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Unsupported currency code",
    },
    [exports.BusinessErrorCode.INVALID_AMOUNT]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid amount value",
    },
    [exports.BusinessErrorCode.INVALID_INVOICE_NUMBER]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid invoice number format",
    },
    [exports.BusinessErrorCode.INVALID_VAT_RATE]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "VAT rate must be between 0 and 100",
    },
    [exports.BusinessErrorCode.INVALID_PERIOD]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid period specification",
    },
    [exports.BusinessErrorCode.EMPTY_COLLECTION]: {
        category: exports.ErrorCategory.VALIDATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Collection cannot be empty",
    },
    // Calculation errors
    [exports.BusinessErrorCode.CURRENCY_MISMATCH]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Cannot operate on amounts with different currencies",
    },
    [exports.BusinessErrorCode.OVERFLOW]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Calculation resulted in overflow",
    },
    [exports.BusinessErrorCode.DIVISION_BY_ZERO]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Cannot divide by zero",
    },
    [exports.BusinessErrorCode.PRECISION_LOSS]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Calculation may have precision loss",
    },
    [exports.BusinessErrorCode.ROUNDING_ERROR]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Rounding produced unexpected result",
    },
    [exports.BusinessErrorCode.NEGATIVE_AMOUNT_NOT_ALLOWED]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Negative amounts are not allowed for this operation",
    },
    [exports.BusinessErrorCode.CALCULATION_FAILED]: {
        category: exports.ErrorCategory.CALCULATION,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Calculation failed",
    },
    // Reconciliation errors
    [exports.BusinessErrorCode.BALANCE_MISMATCH]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Bank and invoice totals do not match",
    },
    [exports.BusinessErrorCode.UNMATCHED_TRANSACTIONS]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Some bank transactions are unmatched",
    },
    [exports.BusinessErrorCode.UNMATCHED_INVOICES]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Some invoices are unmatched",
    },
    [exports.BusinessErrorCode.TOLERANCE_EXCEEDED]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Balance difference exceeds tolerance",
    },
    [exports.BusinessErrorCode.DUPLICATE_MATCH]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: true,
        retryable: false,
        defaultMessage: "Duplicate match detected",
    },
    [exports.BusinessErrorCode.MATCH_NOT_FOUND]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Match not found",
    },
    [exports.BusinessErrorCode.RECONCILIATION_INCOMPLETE]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Reconciliation is incomplete",
    },
    [exports.BusinessErrorCode.PERIOD_NOT_READY]: {
        category: exports.ErrorCategory.RECONCILIATION,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Period is not ready for finalization",
    },
    // State errors
    [exports.BusinessErrorCode.INVALID_STATUS_TRANSITION]: {
        category: exports.ErrorCategory.STATE,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Invalid status transition",
    },
    [exports.BusinessErrorCode.PERIOD_FINALIZED]: {
        category: exports.ErrorCategory.STATE,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Cannot modify finalized period",
    },
    [exports.BusinessErrorCode.PERIOD_LOCKED]: {
        category: exports.ErrorCategory.STATE,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: false,
        retryable: true,
        defaultMessage: "Period is currently locked",
    },
    [exports.BusinessErrorCode.OPERATION_NOT_ALLOWED]: {
        category: exports.ErrorCategory.STATE,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: false,
        retryable: false,
        defaultMessage: "Operation not allowed in current state",
    },
    [exports.BusinessErrorCode.CONCURRENT_MODIFICATION]: {
        category: exports.ErrorCategory.STATE,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: true,
        defaultMessage: "Data was modified by another process",
    },
    // Data errors
    [exports.BusinessErrorCode.DATA_CORRUPTION]: {
        category: exports.ErrorCategory.DATA,
        severity: exports.ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        defaultMessage: "Data integrity check failed",
    },
    [exports.BusinessErrorCode.SCHEMA_MISMATCH]: {
        category: exports.ErrorCategory.DATA,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Data schema version mismatch",
    },
    [exports.BusinessErrorCode.INTEGRITY_VIOLATION]: {
        category: exports.ErrorCategory.DATA,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Data integrity constraint violated",
    },
    [exports.BusinessErrorCode.REFERENCE_NOT_FOUND]: {
        category: exports.ErrorCategory.DATA,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "Referenced data not found",
    },
    [exports.BusinessErrorCode.DUPLICATE_ENTRY]: {
        category: exports.ErrorCategory.DATA,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Duplicate entry detected",
    },
    // Export errors
    [exports.BusinessErrorCode.EXPORT_FAILED]: {
        category: exports.ErrorCategory.EXPORT,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: true,
        retryable: true,
        defaultMessage: "Export failed",
    },
    [exports.BusinessErrorCode.INVALID_EXPORT_FORMAT]: {
        category: exports.ErrorCategory.EXPORT,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Invalid export format requested",
    },
    [exports.BusinessErrorCode.NO_DATA_TO_EXPORT]: {
        category: exports.ErrorCategory.EXPORT,
        severity: exports.ErrorSeverity.INFO,
        recoverable: true,
        retryable: false,
        defaultMessage: "No data available to export",
    },
    [exports.BusinessErrorCode.EXPORT_SIZE_EXCEEDED]: {
        category: exports.ErrorCategory.EXPORT,
        severity: exports.ErrorSeverity.WARNING,
        recoverable: true,
        retryable: false,
        defaultMessage: "Export size exceeds limit",
    },
    // Internal errors
    [exports.BusinessErrorCode.INTERNAL_ERROR]: {
        category: exports.ErrorCategory.INTERNAL,
        severity: exports.ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        defaultMessage: "An unexpected error occurred",
    },
    [exports.BusinessErrorCode.UNKNOWN_ERROR]: {
        category: exports.ErrorCategory.INTERNAL,
        severity: exports.ErrorSeverity.ERROR,
        recoverable: false,
        retryable: false,
        defaultMessage: "An unknown error occurred",
    },
};
// ============================================================================
// ERROR CREATION HELPERS
// ============================================================================
/**
 * Creates a BusinessError with metadata
 *
 * @param code - Error code from BusinessErrorCode
 * @param options - Optional overrides and additional data
 * @returns Fully constructed BusinessError
 */
function createBusinessError(code, options) {
    var _a;
    const metadata = exports.ERROR_METADATA[code];
    return {
        code,
        message: (_a = options === null || options === void 0 ? void 0 : options.message) !== null && _a !== void 0 ? _a : metadata.defaultMessage,
        category: metadata.category,
        severity: metadata.severity,
        recoverable: metadata.recoverable,
        retryable: metadata.retryable,
        details: options === null || options === void 0 ? void 0 : options.details,
        cause: options === null || options === void 0 ? void 0 : options.cause,
    };
}
/**
 * Type guard to check if an object is a BusinessError
 */
function isBusinessError(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value;
    return (typeof obj.code === "string" &&
        typeof obj.message === "string" &&
        typeof obj.category === "string" &&
        typeof obj.severity === "string" &&
        typeof obj.recoverable === "boolean" &&
        typeof obj.retryable === "boolean");
}
/**
 * Extracts the category from an error code
 */
function getCategoryFromCode(code) {
    return exports.ERROR_METADATA[code].category;
}
/**
 * Checks if an error code indicates a critical error
 */
function isCritical(code) {
    return exports.ERROR_METADATA[code].severity === exports.ErrorSeverity.CRITICAL;
}
/**
 * Checks if an error is user-actionable
 */
function isUserActionable(error) {
    return error.recoverable || error.retryable;
}
//# sourceMappingURL=businessErrors.js.map