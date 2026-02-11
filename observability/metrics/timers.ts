/**
 * Timers - Performance timing metrics
 *
 * INVARIANT: Timers measure wall-clock ONLY
 * INVARIANT: Timers NEVER introduce timeouts
 * INVARIANT: Timers NEVER trigger retries
 * INVARIANT: Timer failures NEVER affect business logic
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";

// ============================================================================
// TIMER TYPES
// ============================================================================

/**
 * Completed timing measurement
 */
export interface TimingMeasurement {
  /** Unique measurement ID */
  readonly id: string;
  /** Operation being timed */
  readonly operation: string;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Start timestamp */
  readonly startTime: number;
  /** End timestamp */
  readonly endTime: number;
  /** Trace context */
  readonly traceId?: string;
  /** Workflow execution ID */
  readonly workflowExecutionId?: string;
  /** Additional labels */
  readonly labels?: Readonly<Record<string, string>>;
  /** Whether the operation succeeded */
  readonly success: boolean;
}

/**
 * Active timer handle
 */
export interface Timer {
  /** Stop the timer and record measurement */
  readonly stop: (success?: boolean) => TimingMeasurement;
  /** Get elapsed time without stopping */
  readonly elapsed: () => number;
  /** Get the operation name */
  readonly operation: string;
  /** Check if timer is still running */
  readonly isRunning: () => boolean;
}

// ============================================================================
// TIMER IMPLEMENTATION
// ============================================================================

let timerCounter = 0;

/**
 * Creates and starts a timer
 *
 * USAGE:
 * ```typescript
 * const timer = startTimer("parse_file", traceContext);
 * try {
 *   await doWork();
 *   const measurement = timer.stop(true);
 * } catch (error) {
 *   const measurement = timer.stop(false);
 *   throw error; // Re-throw - timer is observational only
 * }
 * ```
 */
export function startTimer(
  operation: string,
  traceContext?: TraceContext,
  workflowContext?: WorkflowContext,
  labels?: Record<string, string>
): Timer {
  const id = `tm_${Date.now()}_${++timerCounter}`;
  const startTime = Date.now();
  let stopped = false;
  let measurement: TimingMeasurement | null = null;

  return {
    operation,

    stop(success: boolean = true): TimingMeasurement {
      if (stopped && measurement) {
        // Already stopped, return existing measurement
        return measurement;
      }

      const endTime = Date.now();
      stopped = true;

      measurement = Object.freeze({
        id,
        operation,
        durationMs: endTime - startTime,
        startTime,
        endTime,
        traceId: traceContext?.traceId,
        workflowExecutionId: workflowContext?.workflowExecutionId,
        labels: labels ? Object.freeze({ ...labels }) : undefined,
        success,
      });

      return measurement;
    },

    elapsed(): number {
      if (stopped && measurement) {
        return measurement.durationMs;
      }
      return Date.now() - startTime;
    },

    isRunning(): boolean {
      return !stopped;
    },
  };
}

// ============================================================================
// TIMING DECORATOR
// ============================================================================

/**
 * Times an async function execution
 *
 * INVARIANT: Function behavior is unchanged
 * INVARIANT: Errors are re-thrown after timing
 *
 * USAGE:
 * ```typescript
 * const [result, measurement] = await timedAsync("parse", async () => {
 *   return await parseFile(content);
 * }, traceContext);
 * ```
 */
export async function timedAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  traceContext?: TraceContext,
  workflowContext?: WorkflowContext,
  labels?: Record<string, string>
): Promise<[T, TimingMeasurement]> {
  const timer = startTimer(operation, traceContext, workflowContext, labels);

  try {
    const result = await fn();
    const measurement = timer.stop(true);
    return [result, measurement];
  } catch (error) {
    const measurement = timer.stop(false);
    // Re-throw - timing is observational only
    throw Object.assign(error as Error, { __timing: measurement });
  }
}

/**
 * Times a sync function execution
 */
export function timedSync<T>(
  operation: string,
  fn: () => T,
  traceContext?: TraceContext,
  workflowContext?: WorkflowContext,
  labels?: Record<string, string>
): [T, TimingMeasurement] {
  const timer = startTimer(operation, traceContext, workflowContext, labels);

  try {
    const result = fn();
    const measurement = timer.stop(true);
    return [result, measurement];
  } catch (error) {
    const measurement = timer.stop(false);
    // Re-throw - timing is observational only
    throw Object.assign(error as Error, { __timing: measurement });
  }
}

// ============================================================================
// TIMING AGGREGATION
// ============================================================================

/**
 * Timing statistics for an operation
 */
export interface TimingStats {
  readonly operation: string;
  readonly count: number;
  readonly totalMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly avgMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly successRate: number;
}

/**
 * Aggregates timing measurements into statistics
 */
export function aggregateTimings(measurements: readonly TimingMeasurement[]): TimingStats | null {
  if (measurements.length === 0) {
    return null;
  }

  const operation = measurements[0].operation;
  const durations = measurements.map((m) => m.durationMs).sort((a, b) => a - b);
  const successCount = measurements.filter((m) => m.success).length;

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * durations.length) - 1;
    return durations[Math.max(0, index)];
  };

  return {
    operation,
    count: measurements.length,
    totalMs: durations.reduce((sum, d) => sum + d, 0),
    minMs: durations[0],
    maxMs: durations[durations.length - 1],
    avgMs: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    p50Ms: percentile(50),
    p95Ms: percentile(95),
    p99Ms: percentile(99),
    successRate: successCount / measurements.length,
  };
}

// ============================================================================
// TIMING COLLECTOR
// ============================================================================

/**
 * Collects and aggregates timing measurements
 * INVARIANT: Collection failures NEVER affect business logic
 */
export class TimingCollector {
  private readonly measurements: Map<string, TimingMeasurement[]> = new Map();
  private readonly maxMeasurementsPerOperation: number;

  constructor(maxMeasurementsPerOperation: number = 1000) {
    this.maxMeasurementsPerOperation = maxMeasurementsPerOperation;
  }

  /**
   * Records a timing measurement
   */
  record(measurement: TimingMeasurement): void {
    try {
      const existing = this.measurements.get(measurement.operation) ?? [];

      // Limit measurements to prevent memory issues
      if (existing.length >= this.maxMeasurementsPerOperation) {
        existing.shift();
      }

      existing.push(measurement);
      this.measurements.set(measurement.operation, existing);
    } catch {
      // Silent failure - observability must not affect business logic
    }
  }

  /**
   * Gets statistics for an operation
   */
  getStats(operation: string): TimingStats | null {
    const measurements = this.measurements.get(operation);
    if (!measurements) {
      return null;
    }
    return aggregateTimings(measurements);
  }

  /**
   * Gets statistics for all operations
   */
  getAllStats(): readonly TimingStats[] {
    const stats: TimingStats[] = [];
    for (const [operation] of this.measurements) {
      const stat = this.getStats(operation);
      if (stat) {
        stats.push(stat);
      }
    }
    return stats;
  }

  /**
   * Clears all measurements
   */
  clear(): void {
    this.measurements.clear();
  }

  /**
   * Clears measurements for a specific operation
   */
  clearOperation(operation: string): void {
    this.measurements.delete(operation);
  }
}

/**
 * Global timing collector singleton
 */
let globalCollector: TimingCollector | null = null;

/**
 * Gets the global timing collector
 */
export function getGlobalTimingCollector(): TimingCollector {
  if (!globalCollector) {
    globalCollector = new TimingCollector();
  }
  return globalCollector;
}

/**
 * Records a timing measurement to the global collector
 */
export function recordTiming(measurement: TimingMeasurement): void {
  getGlobalTimingCollector().record(measurement);
}
