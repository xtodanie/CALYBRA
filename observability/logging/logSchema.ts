/**
 * Log Schema - Structured log entry types
 *
 * INVARIANT: All logs must conform to this schema
 * INVARIANT: No free-form text logs allowed
 * INVARIANT: All logs include trace context
 * INVARIANT: No PII or secrets in logs
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";

// ============================================================================
// LOG LEVELS
// ============================================================================

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * Numeric log level for filtering
 */
export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
} as const;

// ============================================================================
// LOG RESULT
// ============================================================================

export type LogResult = "SUCCESS" | "FAILURE" | "PARTIAL" | "SKIPPED";

// ============================================================================
// LOG ENTRY TYPES
// ============================================================================

/**
 * Base structured log entry - all logs must include these fields
 */
export interface BaseLogEntry {
  /** Log level */
  readonly level: LogLevel;
  /** ISO timestamp */
  readonly timestamp: string;
  /** Trace ID from trace context */
  readonly traceId: string;
  /** Workflow execution ID if applicable */
  readonly workflowExecutionId?: string;
  /** Tenant ID if known */
  readonly tenantId?: string;
  /** Actor performing the operation */
  readonly actor: LogActor;
  /** Component emitting the log */
  readonly component: string;
  /** Operation being performed */
  readonly operation: string;
  /** Result of the operation */
  readonly result: LogResult;
  /** Duration in milliseconds if measurable */
  readonly durationMs?: number;
  /** Human-readable message (structured, not free-form) */
  readonly message: string;
}

/**
 * Actor information for logs
 */
export interface LogActor {
  /** Actor type */
  readonly type: "USER" | "SERVER" | "SYSTEM";
  /** Actor ID if known */
  readonly id?: string;
}

/**
 * Extended log entry with additional context
 */
export interface LogEntry extends BaseLogEntry {
  /** Additional structured data */
  readonly data?: Readonly<Record<string, unknown>>;
  /** Error information if applicable */
  readonly error?: LogError;
  /** Tags for categorization */
  readonly tags?: readonly string[];
}

/**
 * Error information in logs
 */
export interface LogError {
  /** Error type/name */
  readonly type: string;
  /** Error message */
  readonly message: string;
  /** Error code if available */
  readonly code?: string;
  /** Stack trace (sanitized, no secrets) */
  readonly stack?: string;
}

// ============================================================================
// LOG ENTRY FACTORY
// ============================================================================

export interface CreateLogEntryOptions {
  level: LogLevel;
  component: string;
  operation: string;
  result: LogResult;
  message: string;
  traceContext?: TraceContext;
  workflowContext?: WorkflowContext;
  durationMs?: number;
  data?: Record<string, unknown>;
  error?: Error | LogError;
  tags?: string[];
}

/**
 * Creates a structured log entry
 */
export function createLogEntry(options: CreateLogEntryOptions): LogEntry {
  const actor: LogActor = {
    type: options.traceContext?.actorType ?? "SYSTEM",
    id: options.traceContext?.actorId,
  };

  const entry: LogEntry = {
    level: options.level,
    timestamp: new Date().toISOString(),
    traceId: options.traceContext?.traceId ?? "tr_unknown",
    workflowExecutionId: options.workflowContext?.workflowExecutionId,
    tenantId: options.traceContext?.tenantId ?? options.workflowContext?.tenantId,
    actor,
    component: options.component,
    operation: options.operation,
    result: options.result,
    durationMs: options.durationMs,
    message: options.message,
    data: options.data ? Object.freeze({ ...options.data }) : undefined,
    error: options.error ? normalizeError(options.error) : undefined,
    tags: options.tags ? Object.freeze([...options.tags]) : undefined,
  };

  return Object.freeze(entry);
}

/**
 * Normalizes an error to LogError format
 */
function normalizeError(error: Error | LogError): LogError {
  if ("type" in error && typeof error.type === "string") {
    // Already a LogError
    return error as LogError;
  }

  const err = error as Error;
  return {
    type: err.name ?? "Error",
    message: err.message ?? "Unknown error",
    code: (err as { code?: string }).code,
    stack: sanitizeStack(err.stack),
  };
}

/**
 * Sanitizes stack trace to remove sensitive information
 */
function sanitizeStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;

  // Remove file paths that might contain usernames or sensitive paths
  // Keep only the essential stack information
  return stack
    .split("\n")
    .slice(0, 10) // Limit stack depth
    .map((line) => {
      // Remove absolute paths, keep relative
      return line.replace(/[A-Za-z]:[\\\/][^\s)]+/g, "[path]");
    })
    .join("\n");
}

// ============================================================================
// LOG ENTRY VALIDATION
// ============================================================================

/**
 * Validates that a log entry has all required fields
 */
export function isValidLogEntry(entry: unknown): entry is LogEntry {
  if (!entry || typeof entry !== "object") return false;

  const e = entry as Record<string, unknown>;

  return (
    typeof e.level === "string" &&
    ["DEBUG", "INFO", "WARN", "ERROR"].includes(e.level) &&
    typeof e.timestamp === "string" &&
    typeof e.traceId === "string" &&
    typeof e.component === "string" &&
    typeof e.operation === "string" &&
    typeof e.result === "string" &&
    typeof e.message === "string" &&
    e.actor !== undefined &&
    typeof (e.actor as LogActor).type === "string"
  );
}

// ============================================================================
// FORBIDDEN PATTERNS
// ============================================================================

/**
 * Patterns that should never appear in logs (PII, secrets)
 */
const FORBIDDEN_PATTERNS = [
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /token(?!Id)/i, // Allow tokenId but not token alone
  /credential/i,
  /private[_-]?key/i,
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/, // Credit card pattern
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN pattern
];

/**
 * Checks if a log entry contains forbidden patterns
 * This is a diagnostic function, not enforcement
 */
export function checkForForbiddenPatterns(entry: LogEntry): string[] {
  const violations: string[] = [];
  const stringified = JSON.stringify(entry);

  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(stringified)) {
      violations.push(`Log entry may contain sensitive data matching: ${pattern.source}`);
    }
  }

  return violations;
}
