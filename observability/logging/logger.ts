/**
 * Logger - Structured logging implementation
 *
 * INVARIANT: All output is structured JSON
 * INVARIANT: Logger failures NEVER affect business logic
 * INVARIANT: Logger NEVER throws exceptions
 * INVARIANT: Logger is purely observational
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";
import {
  LogEntry,
  LogLevel,
  LogResult,
  LOG_LEVEL_VALUES,
  createLogEntry,
  isValidLogEntry,
  checkForForbiddenPatterns,
} from "./logSchema";

// ============================================================================
// LOGGER CONFIGURATION
// ============================================================================

export interface LoggerConfig {
  /** Minimum log level to output */
  readonly minLevel: LogLevel;
  /** Whether to include stack traces */
  readonly includeStacks: boolean;
  /** Whether to pretty print JSON */
  readonly prettyPrint: boolean;
  /** Custom output sink (defaults to console) */
  readonly sink?: LogSink;
  /** Whether to validate logs for forbidden patterns */
  readonly validatePatterns: boolean;
}

export type LogSink = (entry: LogEntry) => void;

const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: "INFO",
  includeStacks: true,
  prettyPrint: false,
  validatePatterns: process.env.NODE_ENV !== "production",
};

// ============================================================================
// LOGGER CLASS
// ============================================================================

/**
 * Structured logger with trace context support
 *
 * USAGE:
 * ```typescript
 * const logger = createLogger("MyComponent", traceContext);
 * logger.info("operation_started", "Starting operation", { entityId: "123" });
 * logger.error("operation_failed", "Operation failed", { entityId: "123" }, error);
 * ```
 */
export class Logger {
  private readonly component: string;
  private readonly traceContext?: TraceContext;
  private readonly workflowContext?: WorkflowContext;
  private readonly config: LoggerConfig;

  constructor(
    component: string,
    traceContext?: TraceContext,
    workflowContext?: WorkflowContext,
    config?: Partial<LoggerConfig>
  ) {
    this.component = component;
    this.traceContext = traceContext;
    this.workflowContext = workflowContext;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Creates a child logger with additional context
   */
  child(
    component?: string,
    additionalTraceContext?: Partial<TraceContext>,
    additionalWorkflowContext?: WorkflowContext
  ): Logger {
    return new Logger(
      component ?? this.component,
      additionalTraceContext
        ? { ...this.traceContext, ...additionalTraceContext } as TraceContext
        : this.traceContext,
      additionalWorkflowContext ?? this.workflowContext,
      this.config
    );
  }

  /**
   * Log at DEBUG level
   */
  debug(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
    result: LogResult = "SUCCESS"
  ): void {
    this.log("DEBUG", operation, message, result, data);
  }

  /**
   * Log at INFO level
   */
  info(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
    result: LogResult = "SUCCESS"
  ): void {
    this.log("INFO", operation, message, result, data);
  }

  /**
   * Log at WARN level
   */
  warn(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
    result: LogResult = "PARTIAL"
  ): void {
    this.log("WARN", operation, message, result, data);
  }

  /**
   * Log at ERROR level
   */
  error(
    operation: string,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ): void {
    this.log("ERROR", operation, message, "FAILURE", data, error);
  }

  /**
   * Log with timing information
   */
  timed(
    operation: string,
    message: string,
    durationMs: number,
    data?: Record<string, unknown>,
    result: LogResult = "SUCCESS"
  ): void {
    this.log("INFO", operation, message, result, { ...data, durationMs }, undefined, durationMs);
  }

  /**
   * Core logging method
   * INVARIANT: NEVER throws
   */
  private log(
    level: LogLevel,
    operation: string,
    message: string,
    result: LogResult,
    data?: Record<string, unknown>,
    error?: Error,
    durationMs?: number
  ): void {
    try {
      // Check minimum level
      if (LOG_LEVEL_VALUES[level] < LOG_LEVEL_VALUES[this.config.minLevel]) {
        return;
      }

      // Create structured entry
      const entry = createLogEntry({
        level,
        component: this.component,
        operation,
        result,
        message,
        traceContext: this.traceContext,
        workflowContext: this.workflowContext,
        durationMs,
        data,
        error: error && this.config.includeStacks ? error : undefined,
      });

      // Validate entry
      if (!isValidLogEntry(entry)) {
        this.outputFallback("Invalid log entry structure", { level, operation, message });
        return;
      }

      // Check for forbidden patterns in non-production
      if (this.config.validatePatterns) {
        const violations = checkForForbiddenPatterns(entry);
        if (violations.length > 0) {
          this.outputFallback("Log entry contains forbidden patterns", {
            violations,
            operation,
          });
        }
      }

      // Output
      this.output(entry);
    } catch {
      // INVARIANT: Logger NEVER throws
      // Silent failure - observability must not affect business logic
      this.outputFallback("Logger internal error", { level, operation, message });
    }
  }

  /**
   * Outputs a log entry
   */
  private output(entry: LogEntry): void {
    if (this.config.sink) {
      try {
        this.config.sink(entry);
      } catch {
        // Fallback to console if custom sink fails
        this.consoleOutput(entry);
      }
    } else {
      this.consoleOutput(entry);
    }
  }

  /**
   * Console output with appropriate level
   */
  private consoleOutput(entry: LogEntry): void {
    const output = this.config.prettyPrint
      ? JSON.stringify(entry, null, 2)
      : JSON.stringify(entry);

    switch (entry.level) {
      case "DEBUG":
        console.debug(output);
        break;
      case "INFO":
        console.info(output);
        break;
      case "WARN":
        console.warn(output);
        break;
      case "ERROR":
        console.error(output);
        break;
    }
  }

  /**
   * Fallback output for logger failures
   */
  private outputFallback(reason: string, context: Record<string, unknown>): void {
    try {
      console.error(
        JSON.stringify({
          level: "ERROR",
          component: "Logger",
          reason,
          context,
          timestamp: new Date().toISOString(),
        })
      );
    } catch {
      // Ultimate fallback - nothing we can do
    }
  }
}

// ============================================================================
// LOGGER FACTORY
// ============================================================================

/**
 * Creates a logger for a component
 */
export function createLogger(
  component: string,
  traceContext?: TraceContext,
  workflowContext?: WorkflowContext,
  config?: Partial<LoggerConfig>
): Logger {
  return new Logger(component, traceContext, workflowContext, config);
}

/**
 * Creates a null logger that discards all output
 * Useful for testing or disabling observability
 */
export function createNullLogger(): Logger {
  return new Logger("null", undefined, undefined, {
    minLevel: "ERROR",
    includeStacks: false,
    prettyPrint: false,
    sink: () => {}, // Discard all output
    validatePatterns: false,
  });
}

// ============================================================================
// LOG BUFFER (for batch export)
// ============================================================================

/**
 * Buffered logger that collects entries for batch export
 */
export class BufferedLogger extends Logger {
  private readonly buffer: LogEntry[] = [];
  private readonly maxBufferSize: number;

  constructor(
    component: string,
    traceContext?: TraceContext,
    workflowContext?: WorkflowContext,
    maxBufferSize: number = 1000
  ) {
    super(component, traceContext, workflowContext, {
      sink: (entry) => this.addToBuffer(entry),
    });
    this.maxBufferSize = maxBufferSize;
  }

  private addToBuffer(entry: LogEntry): void {
    if (this.buffer.length >= this.maxBufferSize) {
      // Drop oldest entries to prevent memory issues
      this.buffer.shift();
    }
    this.buffer.push(entry);
  }

  /**
   * Gets all buffered entries
   */
  getEntries(): readonly LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clears the buffer
   */
  clear(): void {
    this.buffer.length = 0;
  }

  /**
   * Flushes buffer to a sink and clears
   */
  flush(sink: LogSink): void {
    for (const entry of this.buffer) {
      try {
        sink(entry);
      } catch {
        // Ignore sink errors during flush
      }
    }
    this.clear();
  }
}

/**
 * Creates a buffered logger for batch export
 */
export function createBufferedLogger(
  component: string,
  traceContext?: TraceContext,
  workflowContext?: WorkflowContext,
  maxBufferSize?: number
): BufferedLogger {
  return new BufferedLogger(component, traceContext, workflowContext, maxBufferSize);
}
