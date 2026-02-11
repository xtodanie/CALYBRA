/**
 * Error Telemetry - Captures and records errors for observability
 *
 * INVARIANT: Errors are captured AFTER they occur
 * INVARIANT: Original errors are NEVER transformed or wrapped
 * INVARIANT: Error telemetry NEVER throws
 * INVARIANT: Error telemetry NEVER affects control flow
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";

// ============================================================================
// ERROR RECORD TYPES
// ============================================================================

/**
 * Recorded error for telemetry
 */
export interface ErrorRecord {
  /** Unique error record ID */
  readonly errorId: string;
  /** Error type/name */
  readonly errorType: string;
  /** Error message */
  readonly message: string;
  /** Error code if available */
  readonly code?: string;
  /** Stack trace (sanitized) */
  readonly stack?: string;
  /** Component where error occurred */
  readonly component: string;
  /** Operation being performed */
  readonly operation: string;
  /** Entity involved if applicable */
  readonly entityId?: string;
  /** Entity type if applicable */
  readonly entityType?: string;
  /** Tenant ID if known */
  readonly tenantId?: string;
  /** Trace ID for correlation */
  readonly traceId?: string;
  /** Workflow execution ID */
  readonly workflowExecutionId?: string;
  /** Timestamp of error */
  readonly timestamp: number;
  /** Whether the error is recoverable */
  readonly recoverable: boolean;
  /** Whether the operation can be retried */
  readonly retryable: boolean;
  /** Additional context */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Error severity classification
 */
export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

/**
 * Classifies error severity based on error type and context
 */
export function classifyErrorSeverity(error: ErrorRecord): ErrorSeverity {
  // Critical: Data integrity or security issues
  if (
    error.errorType.includes("Integrity") ||
    error.errorType.includes("Security") ||
    error.code?.includes("UNAUTHORIZED") ||
    error.code?.includes("TENANT_MISMATCH")
  ) {
    return "CRITICAL";
  }

  // High: Business logic failures
  if (
    error.code?.includes("INVALID_STATE") ||
    error.code?.includes("TRANSITION") ||
    error.errorType === "StateError"
  ) {
    return "HIGH";
  }

  // Medium: Operational issues
  if (
    error.code?.includes("NOT_FOUND") ||
    error.code?.includes("TIMEOUT") ||
    !error.recoverable
  ) {
    return "MEDIUM";
  }

  // Low: Recoverable/retryable errors
  return "LOW";
}

// ============================================================================
// ERROR CAPTURE
// ============================================================================

let errorCounter = 0;

/**
 * Captures an error for telemetry
 *
 * USAGE: Call this AFTER catching an error
 * ```typescript
 * try {
 *   await doWork();
 * } catch (error) {
 *   captureError(error, "MyComponent", "do_work", {
 *     traceContext,
 *     entityId: someId,
 *   });
 *   throw error; // Re-throw - telemetry doesn't change flow
 * }
 * ```
 */
export function captureError(
  error: Error | unknown,
  component: string,
  operation: string,
  options?: {
    traceContext?: TraceContext;
    workflowContext?: WorkflowContext;
    entityId?: string;
    entityType?: string;
    recoverable?: boolean;
    retryable?: boolean;
    context?: Record<string, unknown>;
  }
): ErrorRecord {
  const err = normalizeToError(error);

  const record: ErrorRecord = Object.freeze({
    errorId: `err_${Date.now()}_${++errorCounter}`,
    errorType: err.name || "Error",
    message: err.message || "Unknown error",
    code: extractErrorCode(err),
    stack: sanitizeStack(err.stack),
    component,
    operation,
    entityId: options?.entityId,
    entityType: options?.entityType,
    tenantId: options?.traceContext?.tenantId ?? options?.workflowContext?.tenantId,
    traceId: options?.traceContext?.traceId,
    workflowExecutionId: options?.workflowContext?.workflowExecutionId,
    timestamp: Date.now(),
    recoverable: options?.recoverable ?? isLikelyRecoverable(err),
    retryable: options?.retryable ?? isLikelyRetryable(err),
    context: options?.context ? Object.freeze({ ...options.context }) : undefined,
  });

  // Record to global collector
  try {
    getGlobalErrorCollector().record(record);
  } catch {
    // Silent failure - error telemetry must not affect business logic
  }

  return record;
}

/**
 * Normalizes any thrown value to an Error
 */
function normalizeToError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (error && typeof error === "object" && "message" in error) {
    const err = new Error(String((error as { message: unknown }).message));
    if ("name" in error) {
      err.name = String((error as { name: unknown }).name);
    }
    return err;
  }

  return new Error("Unknown error");
}

/**
 * Extracts error code from error
 */
function extractErrorCode(error: Error): string | undefined {
  const withCode = error as { code?: unknown };
  if (typeof withCode.code === "string") {
    return withCode.code;
  }
  return undefined;
}

/**
 * Sanitizes stack trace to remove sensitive information
 */
function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;

  return stack
    .split("\n")
    .slice(0, 15) // Limit depth
    .map((line) => {
      // Remove absolute paths
      return line.replace(/[A-Za-z]:[\\\/][^\s)]+/g, "[path]");
    })
    .join("\n");
}

/**
 * Heuristic: is this error likely recoverable?
 */
function isLikelyRecoverable(error: Error): boolean {
  const code = extractErrorCode(error);

  // Not recoverable: permission, tenant issues, terminal states
  if (
    code?.includes("UNAUTHORIZED") ||
    code?.includes("FORBIDDEN") ||
    code?.includes("TENANT_MISMATCH") ||
    code?.includes("FINALIZED") ||
    code?.includes("TERMINAL")
  ) {
    return false;
  }

  return true;
}

/**
 * Heuristic: is this error likely retryable?
 */
function isLikelyRetryable(error: Error): boolean {
  const code = extractErrorCode(error);
  const message = error.message.toLowerCase();

  // Retryable: network, timeout, temporary issues
  if (
    code?.includes("NETWORK") ||
    code?.includes("TIMEOUT") ||
    code?.includes("UNAVAILABLE") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("temporarily")
  ) {
    return true;
  }

  // Not retryable: validation, permission, state issues
  if (
    code?.includes("INVALID") ||
    code?.includes("UNAUTHORIZED") ||
    code?.includes("NOT_FOUND")
  ) {
    return false;
  }

  return false;
}

// ============================================================================
// ERROR COLLECTOR
// ============================================================================

/**
 * Collects error records
 */
export class ErrorCollector {
  private readonly errors: ErrorRecord[] = [];
  private readonly maxErrors: number;

  constructor(maxErrors: number = 5000) {
    this.maxErrors = maxErrors;
  }

  /**
   * Records an error
   * INVARIANT: NEVER throws
   */
  record(error: ErrorRecord): void {
    try {
      if (this.errors.length >= this.maxErrors) {
        this.errors.shift();
      }
      this.errors.push(error);
    } catch {
      // Silent failure
    }
  }

  /**
   * Gets errors by trace ID
   */
  getByTraceId(traceId: string): readonly ErrorRecord[] {
    return this.errors.filter((e) => e.traceId === traceId);
  }

  /**
   * Gets errors by component
   */
  getByComponent(component: string): readonly ErrorRecord[] {
    return this.errors.filter((e) => e.component === component);
  }

  /**
   * Gets errors by code
   */
  getByCode(code: string): readonly ErrorRecord[] {
    return this.errors.filter((e) => e.code === code);
  }

  /**
   * Gets errors by severity
   */
  getBySeverity(severity: ErrorSeverity): readonly ErrorRecord[] {
    return this.errors.filter((e) => classifyErrorSeverity(e) === severity);
  }

  /**
   * Gets recent errors
   */
  getRecent(count: number = 100): readonly ErrorRecord[] {
    return this.errors.slice(-count);
  }

  /**
   * Gets all errors
   */
  getAll(): readonly ErrorRecord[] {
    return [...this.errors];
  }

  /**
   * Clears all errors
   */
  clear(): void {
    this.errors.length = 0;
  }
}

// ============================================================================
// GLOBAL COLLECTOR
// ============================================================================

let globalErrorCollector: ErrorCollector | null = null;

/**
 * Gets the global error collector
 */
export function getGlobalErrorCollector(): ErrorCollector {
  if (!globalErrorCollector) {
    globalErrorCollector = new ErrorCollector();
  }
  return globalErrorCollector;
}

// ============================================================================
// ERROR STATISTICS
// ============================================================================

/**
 * Error statistics
 */
export interface ErrorStats {
  readonly totalErrors: number;
  readonly bySeverity: Readonly<Record<ErrorSeverity, number>>;
  readonly byComponent: Readonly<Record<string, number>>;
  readonly byCode: Readonly<Record<string, number>>;
  readonly recoverableCount: number;
  readonly retryableCount: number;
}

/**
 * Computes error statistics
 */
export function computeErrorStats(errors: readonly ErrorRecord[]): ErrorStats {
  const bySeverity: Record<ErrorSeverity, number> = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  const byComponent: Record<string, number> = {};
  const byCode: Record<string, number> = {};
  let recoverableCount = 0;
  let retryableCount = 0;

  for (const error of errors) {
    // By severity
    const severity = classifyErrorSeverity(error);
    bySeverity[severity]++;

    // By component
    byComponent[error.component] = (byComponent[error.component] ?? 0) + 1;

    // By code
    if (error.code) {
      byCode[error.code] = (byCode[error.code] ?? 0) + 1;
    }

    // Counts
    if (error.recoverable) recoverableCount++;
    if (error.retryable) retryableCount++;
  }

  return {
    totalErrors: errors.length,
    bySeverity: Object.freeze(bySeverity),
    byComponent: Object.freeze(byComponent),
    byCode: Object.freeze(byCode),
    recoverableCount,
    retryableCount,
  };
}
