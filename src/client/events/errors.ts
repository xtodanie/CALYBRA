/**
 * Error Events - Structured error handling
 *
 * Every error must be:
 * - Deterministic
 * - Mapped to a known category
 * - Explainable to a human
 * - Actionable or explicitly non-actionable
 *
 * INVARIANT: No raw stack traces in UI
 * INVARIANT: All errors have recovery guidance
 */

// ============================================================================
// ERROR CATEGORIES
// ============================================================================

export type ErrorCategory =
  | "PERMISSION"       // User lacks permission
  | "VALIDATION"       // Input validation failed
  | "STATE"            // Invalid state transition
  | "NOT_FOUND"        // Resource not found
  | "CONFLICT"         // Resource conflict (already exists, etc.)
  | "NETWORK"          // Network/connectivity issue
  | "SERVER"           // Server-side error
  | "TIMEOUT"          // Operation timed out
  | "UNKNOWN";         // Unclassified error

// ============================================================================
// ERROR SEVERITY
// ============================================================================

export type ErrorSeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";

// ============================================================================
// STRUCTURED ERROR TYPE
// ============================================================================

export interface OrchestrationError {
  readonly id: string;
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly message: string;
  readonly userMessage: string;
  readonly timestamp: number;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly actions: readonly ErrorAction[];
  readonly context?: Record<string, unknown>;
}

export interface ErrorAction {
  readonly id: string;
  readonly label: string;
  readonly type: "RETRY" | "DISMISS" | "NAVIGATE" | "CONTACT_SUPPORT";
  readonly payload?: unknown;
}

// ============================================================================
// ERROR CODES BY DOMAIN
// ============================================================================

export const ERROR_CODES = {
  // Permission errors
  PERMISSION_DENIED: "PERMISSION_DENIED",
  ROLE_INSUFFICIENT: "ROLE_INSUFFICIENT",
  TENANT_MISMATCH: "TENANT_MISMATCH",

  // Validation errors
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",

  // State errors
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",
  MONTH_CLOSE_FINALIZED: "MONTH_CLOSE_FINALIZED",
  ALREADY_PARSED: "ALREADY_PARSED",
  MATCH_ALREADY_CONFIRMED: "MATCH_ALREADY_CONFIRMED",
  MATCH_ALREADY_REJECTED: "MATCH_ALREADY_REJECTED",

  // Not found errors
  FILE_NOT_FOUND: "FILE_NOT_FOUND",
  INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  MONTH_CLOSE_NOT_FOUND: "MONTH_CLOSE_NOT_FOUND",
  TRANSACTION_NOT_FOUND: "TRANSACTION_NOT_FOUND",

  // Conflict errors
  ALREADY_EXISTS: "ALREADY_EXISTS",
  DUPLICATE_DETECTED: "DUPLICATE_DETECTED",
  PERIOD_OVERLAP: "PERIOD_OVERLAP",

  // Network errors
  NETWORK_OFFLINE: "NETWORK_OFFLINE",
  CONNECTION_FAILED: "CONNECTION_FAILED",
  REQUEST_TIMEOUT: "REQUEST_TIMEOUT",

  // Server errors
  SERVER_ERROR: "SERVER_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  FUNCTION_ERROR: "FUNCTION_ERROR",

  // Business logic errors
  OPEN_EXCEPTIONS: "OPEN_EXCEPTIONS",
  HIGH_PRIORITY_EXCEPTIONS: "HIGH_PRIORITY_EXCEPTIONS",
  NO_DATA: "NO_DATA",
  PARSE_FAILED: "PARSE_FAILED",

  // Unknown
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ============================================================================
// ERROR METADATA
// ============================================================================

interface ErrorMetadata {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly defaultUserMessage: string;
}

const ERROR_METADATA: Record<ErrorCode, ErrorMetadata> = {
  // Permission errors
  [ERROR_CODES.PERMISSION_DENIED]: {
    category: "PERMISSION",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "You don't have permission to perform this action.",
  },
  [ERROR_CODES.ROLE_INSUFFICIENT]: {
    category: "PERMISSION",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "Your role does not allow this action.",
  },
  [ERROR_CODES.TENANT_MISMATCH]: {
    category: "PERMISSION",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "You do not have access to this resource.",
  },

  // Validation errors
  [ERROR_CODES.INVALID_INPUT]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "The provided input is invalid. Please check and try again.",
  },
  [ERROR_CODES.MISSING_REQUIRED_FIELD]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "A required field is missing.",
  },
  [ERROR_CODES.INVALID_FORMAT]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "The format is invalid. Please check the requirements.",
  },
  [ERROR_CODES.FILE_TOO_LARGE]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "The file is too large. Please use a smaller file.",
  },
  [ERROR_CODES.UNSUPPORTED_FILE_TYPE]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "This file type is not supported.",
  },

  // State errors
  [ERROR_CODES.INVALID_STATUS_TRANSITION]: {
    category: "STATE",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This action is not allowed in the current state.",
  },
  [ERROR_CODES.MONTH_CLOSE_FINALIZED]: {
    category: "STATE",
    severity: "INFO",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This month has been finalized and cannot be modified.",
  },
  [ERROR_CODES.ALREADY_PARSED]: {
    category: "STATE",
    severity: "INFO",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This file has already been parsed.",
  },
  [ERROR_CODES.MATCH_ALREADY_CONFIRMED]: {
    category: "STATE",
    severity: "INFO",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This match has already been confirmed.",
  },
  [ERROR_CODES.MATCH_ALREADY_REJECTED]: {
    category: "STATE",
    severity: "INFO",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This match has already been rejected.",
  },

  // Not found errors
  [ERROR_CODES.FILE_NOT_FOUND]: {
    category: "NOT_FOUND",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "The file could not be found.",
  },
  [ERROR_CODES.INVOICE_NOT_FOUND]: {
    category: "NOT_FOUND",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "The invoice could not be found.",
  },
  [ERROR_CODES.MATCH_NOT_FOUND]: {
    category: "NOT_FOUND",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "The match could not be found.",
  },
  [ERROR_CODES.MONTH_CLOSE_NOT_FOUND]: {
    category: "NOT_FOUND",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "The month close could not be found.",
  },
  [ERROR_CODES.TRANSACTION_NOT_FOUND]: {
    category: "NOT_FOUND",
    severity: "ERROR",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "The transaction could not be found.",
  },

  // Conflict errors
  [ERROR_CODES.ALREADY_EXISTS]: {
    category: "CONFLICT",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This resource already exists.",
  },
  [ERROR_CODES.DUPLICATE_DETECTED]: {
    category: "CONFLICT",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "A duplicate was detected.",
  },
  [ERROR_CODES.PERIOD_OVERLAP]: {
    category: "CONFLICT",
    severity: "WARNING",
    recoverable: false,
    retryable: false,
    defaultUserMessage: "This period overlaps with an existing month close.",
  },

  // Network errors
  [ERROR_CODES.NETWORK_OFFLINE]: {
    category: "NETWORK",
    severity: "WARNING",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "You appear to be offline. Please check your connection.",
  },
  [ERROR_CODES.CONNECTION_FAILED]: {
    category: "NETWORK",
    severity: "WARNING",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "Connection failed. Please try again.",
  },
  [ERROR_CODES.REQUEST_TIMEOUT]: {
    category: "TIMEOUT",
    severity: "WARNING",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "The request timed out. Please try again.",
  },

  // Server errors
  [ERROR_CODES.SERVER_ERROR]: {
    category: "SERVER",
    severity: "ERROR",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "A server error occurred. Please try again later.",
  },
  [ERROR_CODES.SERVICE_UNAVAILABLE]: {
    category: "SERVER",
    severity: "ERROR",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "The service is temporarily unavailable. Please try again later.",
  },
  [ERROR_CODES.FUNCTION_ERROR]: {
    category: "SERVER",
    severity: "ERROR",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "An error occurred processing your request.",
  },

  // Business logic errors
  [ERROR_CODES.OPEN_EXCEPTIONS]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "There are unresolved exceptions that must be addressed.",
  },
  [ERROR_CODES.HIGH_PRIORITY_EXCEPTIONS]: {
    category: "VALIDATION",
    severity: "WARNING",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "There are high-priority issues that must be resolved.",
  },
  [ERROR_CODES.NO_DATA]: {
    category: "VALIDATION",
    severity: "INFO",
    recoverable: true,
    retryable: false,
    defaultUserMessage: "No data available. Please add data first.",
  },
  [ERROR_CODES.PARSE_FAILED]: {
    category: "SERVER",
    severity: "ERROR",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "Failed to parse the file. Please check the format and try again.",
  },

  // Unknown
  [ERROR_CODES.UNKNOWN_ERROR]: {
    category: "UNKNOWN",
    severity: "ERROR",
    recoverable: true,
    retryable: true,
    defaultUserMessage: "An unexpected error occurred. Please try again.",
  },
};

// ============================================================================
// ERROR FACTORY
// ============================================================================

let errorCounter = 0;

/**
 * Creates a structured error from a code
 */
export function createError(
  code: ErrorCode,
  options?: {
    message?: string;
    userMessage?: string;
    context?: Record<string, unknown>;
    actions?: ErrorAction[];
  }
): OrchestrationError {
  const metadata = ERROR_METADATA[code] ?? ERROR_METADATA[ERROR_CODES.UNKNOWN_ERROR];
  const id = `error_${Date.now()}_${++errorCounter}`;

  const defaultActions: ErrorAction[] = [];
  if (metadata.retryable) {
    defaultActions.push({ id: "retry", label: "Try Again", type: "RETRY" });
  }
  defaultActions.push({ id: "dismiss", label: "Dismiss", type: "DISMISS" });

  return {
    id,
    code,
    category: metadata.category,
    severity: metadata.severity,
    message: options?.message ?? code,
    userMessage: options?.userMessage ?? metadata.defaultUserMessage,
    timestamp: Date.now(),
    recoverable: metadata.recoverable,
    retryable: metadata.retryable,
    actions: options?.actions ?? defaultActions,
    context: options?.context,
  };
}

/**
 * Creates an error from an unknown exception
 */
export function createErrorFromException(
  error: unknown,
  fallbackCode: ErrorCode = ERROR_CODES.UNKNOWN_ERROR
): OrchestrationError {
  if (error instanceof Error) {
    // Try to map known error messages to codes
    const code = mapErrorMessageToCode(error.message) ?? fallbackCode;
    return createError(code, {
      message: error.message,
      context: { originalError: error.name },
    });
  }

  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (typeof obj.code === "string" && obj.code in ERROR_METADATA) {
      return createError(obj.code as ErrorCode, {
        message: typeof obj.message === "string" ? obj.message : undefined,
      });
    }
  }

  return createError(fallbackCode);
}

/**
 * Maps common error messages to error codes
 */
function mapErrorMessageToCode(message: string): ErrorCode | null {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("permission") || lowerMessage.includes("denied")) {
    return ERROR_CODES.PERMISSION_DENIED;
  }
  if (lowerMessage.includes("not found")) {
    return ERROR_CODES.FILE_NOT_FOUND;
  }
  if (lowerMessage.includes("already exists")) {
    return ERROR_CODES.ALREADY_EXISTS;
  }
  if (lowerMessage.includes("timeout")) {
    return ERROR_CODES.REQUEST_TIMEOUT;
  }
  if (lowerMessage.includes("network") || lowerMessage.includes("offline")) {
    return ERROR_CODES.NETWORK_OFFLINE;
  }
  if (lowerMessage.includes("finalized")) {
    return ERROR_CODES.MONTH_CLOSE_FINALIZED;
  }
  if (lowerMessage.includes("transition")) {
    return ERROR_CODES.INVALID_STATUS_TRANSITION;
  }

  return null;
}

// ============================================================================
// ERROR EXPLANATION HELPERS
// ============================================================================

/**
 * Returns a detailed explanation for an error code
 */
export function explainError(error: OrchestrationError): string {
  const parts: string[] = [error.userMessage];

  if (error.recoverable) {
    parts.push("This issue can be resolved.");
  } else {
    parts.push("This action cannot be completed in the current state.");
  }

  if (error.retryable) {
    parts.push("You can try again.");
  }

  return parts.join(" ");
}

/**
 * Returns suggested next steps for an error
 */
export function suggestNextSteps(error: OrchestrationError): string[] {
  const steps: string[] = [];

  switch (error.category) {
    case "PERMISSION":
      steps.push("Contact your administrator if you need access.");
      break;
    case "VALIDATION":
      steps.push("Check the input and correct any issues.");
      break;
    case "STATE":
      steps.push("Check the current status of the resource.");
      break;
    case "NOT_FOUND":
      steps.push("Verify the resource exists and you have access.");
      break;
    case "CONFLICT":
      steps.push("Check for existing resources that may conflict.");
      break;
    case "NETWORK":
      steps.push("Check your internet connection.");
      steps.push("Try refreshing the page.");
      break;
    case "SERVER":
      steps.push("Wait a moment and try again.");
      steps.push("If the problem persists, contact support.");
      break;
    case "TIMEOUT":
      steps.push("The operation may still be processing.");
      steps.push("Wait a moment before trying again.");
      break;
  }

  return steps;
}
