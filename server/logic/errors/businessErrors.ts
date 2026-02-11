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

// ============================================================================
// ERROR CODES BY DOMAIN
// ============================================================================

/**
 * Error code categories for structured error handling
 */
export const BusinessErrorCode = {
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
} as const;

export type BusinessErrorCodeType =
  (typeof BusinessErrorCode)[keyof typeof BusinessErrorCode];

// ============================================================================
// ERROR SEVERITY
// ============================================================================

export const ErrorSeverity = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
} as const;

export type ErrorSeverityType = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

// ============================================================================
// ERROR CATEGORY
// ============================================================================

export const ErrorCategory = {
  VALIDATION: "VALIDATION",
  CALCULATION: "CALCULATION",
  RECONCILIATION: "RECONCILIATION",
  STATE: "STATE",
  DATA: "DATA",
  EXPORT: "EXPORT",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCategoryType = (typeof ErrorCategory)[keyof typeof ErrorCategory];

// ============================================================================
// BUSINESS ERROR TYPE
// ============================================================================

/**
 * Structured business error
 *
 * @property code - Error code from BusinessErrorCode
 * @property message - UX-safe message for display
 * @property category - Error category for routing
 * @property severity - Error severity level
 * @property recoverable - Whether the error can be recovered from
 * @property retryable - Whether the operation can be retried
 * @property details - Optional structured details (safe for logs only)
 * @property cause - Optional underlying error
 */
export interface BusinessError {
  readonly code: BusinessErrorCodeType;
  readonly message: string;
  readonly category: ErrorCategoryType;
  readonly severity: ErrorSeverityType;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string | number | boolean>>;
  readonly cause?: Readonly<{ code: string; message: string }>;
}

// ============================================================================
// ERROR METADATA
// ============================================================================

interface ErrorMetadata {
  readonly category: ErrorCategoryType;
  readonly severity: ErrorSeverityType;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly defaultMessage: string;
}

/**
 * Complete error metadata mapping
 */
export const ERROR_METADATA: Readonly<
  Record<BusinessErrorCodeType, ErrorMetadata>
> = {
  // Validation errors
  [BusinessErrorCode.INVALID_INPUT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid input provided",
  },
  [BusinessErrorCode.MISSING_REQUIRED_FIELD]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "A required field is missing",
  },
  [BusinessErrorCode.INVALID_FORMAT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid format",
  },
  [BusinessErrorCode.VALUE_OUT_OF_RANGE]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Value is out of acceptable range",
  },
  [BusinessErrorCode.INVALID_DATE_FORMAT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid date format. Use YYYY-MM-DD",
  },
  [BusinessErrorCode.INVALID_CURRENCY]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Unsupported currency code",
  },
  [BusinessErrorCode.INVALID_AMOUNT]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid amount value",
  },
  [BusinessErrorCode.INVALID_INVOICE_NUMBER]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid invoice number format",
  },
  [BusinessErrorCode.INVALID_VAT_RATE]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "VAT rate must be between 0 and 100",
  },
  [BusinessErrorCode.INVALID_PERIOD]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid period specification",
  },
  [BusinessErrorCode.EMPTY_COLLECTION]: {
    category: ErrorCategory.VALIDATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Collection cannot be empty",
  },

  // Calculation errors
  [BusinessErrorCode.CURRENCY_MISMATCH]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Cannot operate on amounts with different currencies",
  },
  [BusinessErrorCode.OVERFLOW]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Calculation resulted in overflow",
  },
  [BusinessErrorCode.DIVISION_BY_ZERO]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Cannot divide by zero",
  },
  [BusinessErrorCode.PRECISION_LOSS]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Calculation may have precision loss",
  },
  [BusinessErrorCode.ROUNDING_ERROR]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Rounding produced unexpected result",
  },
  [BusinessErrorCode.NEGATIVE_AMOUNT_NOT_ALLOWED]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Negative amounts are not allowed for this operation",
  },
  [BusinessErrorCode.CALCULATION_FAILED]: {
    category: ErrorCategory.CALCULATION,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Calculation failed",
  },

  // Reconciliation errors
  [BusinessErrorCode.BALANCE_MISMATCH]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Bank and invoice totals do not match",
  },
  [BusinessErrorCode.UNMATCHED_TRANSACTIONS]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Some bank transactions are unmatched",
  },
  [BusinessErrorCode.UNMATCHED_INVOICES]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Some invoices are unmatched",
  },
  [BusinessErrorCode.TOLERANCE_EXCEEDED]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Balance difference exceeds tolerance",
  },
  [BusinessErrorCode.DUPLICATE_MATCH]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    retryable: false,
    defaultMessage: "Duplicate match detected",
  },
  [BusinessErrorCode.MATCH_NOT_FOUND]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Match not found",
  },
  [BusinessErrorCode.RECONCILIATION_INCOMPLETE]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Reconciliation is incomplete",
  },
  [BusinessErrorCode.PERIOD_NOT_READY]: {
    category: ErrorCategory.RECONCILIATION,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Period is not ready for finalization",
  },

  // State errors
  [BusinessErrorCode.INVALID_STATUS_TRANSITION]: {
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Invalid status transition",
  },
  [BusinessErrorCode.PERIOD_FINALIZED]: {
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Cannot modify finalized period",
  },
  [BusinessErrorCode.PERIOD_LOCKED]: {
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.WARNING,
    recoverable: false,
    retryable: true,
    defaultMessage: "Period is currently locked",
  },
  [BusinessErrorCode.OPERATION_NOT_ALLOWED]: {
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.WARNING,
    recoverable: false,
    retryable: false,
    defaultMessage: "Operation not allowed in current state",
  },
  [BusinessErrorCode.CONCURRENT_MODIFICATION]: {
    category: ErrorCategory.STATE,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: true,
    defaultMessage: "Data was modified by another process",
  },

  // Data errors
  [BusinessErrorCode.DATA_CORRUPTION]: {
    category: ErrorCategory.DATA,
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    retryable: false,
    defaultMessage: "Data integrity check failed",
  },
  [BusinessErrorCode.SCHEMA_MISMATCH]: {
    category: ErrorCategory.DATA,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Data schema version mismatch",
  },
  [BusinessErrorCode.INTEGRITY_VIOLATION]: {
    category: ErrorCategory.DATA,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Data integrity constraint violated",
  },
  [BusinessErrorCode.REFERENCE_NOT_FOUND]: {
    category: ErrorCategory.DATA,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "Referenced data not found",
  },
  [BusinessErrorCode.DUPLICATE_ENTRY]: {
    category: ErrorCategory.DATA,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Duplicate entry detected",
  },

  // Export errors
  [BusinessErrorCode.EXPORT_FAILED]: {
    category: ErrorCategory.EXPORT,
    severity: ErrorSeverity.ERROR,
    recoverable: true,
    retryable: true,
    defaultMessage: "Export failed",
  },
  [BusinessErrorCode.INVALID_EXPORT_FORMAT]: {
    category: ErrorCategory.EXPORT,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Invalid export format requested",
  },
  [BusinessErrorCode.NO_DATA_TO_EXPORT]: {
    category: ErrorCategory.EXPORT,
    severity: ErrorSeverity.INFO,
    recoverable: true,
    retryable: false,
    defaultMessage: "No data available to export",
  },
  [BusinessErrorCode.EXPORT_SIZE_EXCEEDED]: {
    category: ErrorCategory.EXPORT,
    severity: ErrorSeverity.WARNING,
    recoverable: true,
    retryable: false,
    defaultMessage: "Export size exceeds limit",
  },

  // Internal errors
  [BusinessErrorCode.INTERNAL_ERROR]: {
    category: ErrorCategory.INTERNAL,
    severity: ErrorSeverity.CRITICAL,
    recoverable: false,
    retryable: false,
    defaultMessage: "An unexpected error occurred",
  },
  [BusinessErrorCode.UNKNOWN_ERROR]: {
    category: ErrorCategory.INTERNAL,
    severity: ErrorSeverity.ERROR,
    recoverable: false,
    retryable: false,
    defaultMessage: "An unknown error occurred",
  },
} as const;

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
export function createBusinessError(
  code: BusinessErrorCodeType,
  options?: {
    message?: string;
    details?: Record<string, string | number | boolean>;
    cause?: { code: string; message: string };
  }
): BusinessError {
  const metadata = ERROR_METADATA[code];

  return {
    code,
    message: options?.message ?? metadata.defaultMessage,
    category: metadata.category,
    severity: metadata.severity,
    recoverable: metadata.recoverable,
    retryable: metadata.retryable,
    details: options?.details,
    cause: options?.cause,
  };
}

/**
 * Type guard to check if an object is a BusinessError
 */
export function isBusinessError(value: unknown): value is BusinessError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.code === "string" &&
    typeof obj.message === "string" &&
    typeof obj.category === "string" &&
    typeof obj.severity === "string" &&
    typeof obj.recoverable === "boolean" &&
    typeof obj.retryable === "boolean"
  );
}

/**
 * Extracts the category from an error code
 */
export function getCategoryFromCode(code: BusinessErrorCodeType): ErrorCategoryType {
  return ERROR_METADATA[code].category;
}

/**
 * Checks if an error code indicates a critical error
 */
export function isCritical(code: BusinessErrorCodeType): boolean {
  return ERROR_METADATA[code].severity === ErrorSeverity.CRITICAL;
}

/**
 * Checks if an error is user-actionable
 */
export function isUserActionable(error: BusinessError): boolean {
  return error.recoverable || error.retryable;
}
