/**
 * Counters - Metric counters for tracking occurrences
 *
 * INVARIANT: Counters are purely observational
 * INVARIANT: Counter failures NEVER affect business logic
 * INVARIANT: Counters NEVER gate execution
 */

import { TraceContext } from "../context/traceContext";

// ============================================================================
// COUNTER TYPES
// ============================================================================

/**
 * Counter value with metadata
 */
export interface CounterValue {
  /** Counter name */
  readonly name: string;
  /** Current value */
  readonly value: number;
  /** Labels for dimensions */
  readonly labels: Readonly<Record<string, string>>;
  /** Last update timestamp */
  readonly lastUpdated: number;
}

/**
 * Counter increment event
 */
export interface CounterEvent {
  /** Counter name */
  readonly name: string;
  /** Increment amount (default 1) */
  readonly delta: number;
  /** Labels for dimensions */
  readonly labels: Record<string, string>;
  /** Timestamp */
  readonly timestamp: number;
  /** Trace ID if available */
  readonly traceId?: string;
}

// ============================================================================
// COUNTER IMPLEMENTATION
// ============================================================================

/**
 * Counter that tracks occurrences with labels
 */
export class Counter {
  readonly name: string;
  private readonly values: Map<string, number> = new Map();
  private readonly timestamps: Map<string, number> = new Map();

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Generates a unique key for label combinations
   */
  private labelKey(labels: Record<string, string>): string {
    const sorted = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([k, v]) => `${k}=${v}`).join(",");
  }

  /**
   * Increments the counter
   * INVARIANT: NEVER throws
   */
  inc(labels: Record<string, string> = {}, delta: number = 1): CounterEvent {
    const key = this.labelKey(labels);
    const timestamp = Date.now();

    try {
      const current = this.values.get(key) ?? 0;
      this.values.set(key, current + delta);
      this.timestamps.set(key, timestamp);
    } catch {
      // Silent failure - observability must not affect business logic
    }

    return {
      name: this.name,
      delta,
      labels: { ...labels },
      timestamp,
    };
  }

  /**
   * Gets the current value for a label combination
   */
  get(labels: Record<string, string> = {}): number {
    const key = this.labelKey(labels);
    return this.values.get(key) ?? 0;
  }

  /**
   * Gets all counter values
   */
  getAll(): readonly CounterValue[] {
    const result: CounterValue[] = [];

    for (const [key, value] of this.values) {
      const labels: Record<string, string> = {};
      if (key) {
        for (const part of key.split(",")) {
          const [k, v] = part.split("=");
          if (k && v) {
            labels[k] = v;
          }
        }
      }

      result.push({
        name: this.name,
        value,
        labels: Object.freeze(labels),
        lastUpdated: this.timestamps.get(key) ?? 0,
      });
    }

    return result;
  }

  /**
   * Resets all counter values
   */
  reset(): void {
    this.values.clear();
    this.timestamps.clear();
  }
}

// ============================================================================
// COUNTER REGISTRY
// ============================================================================

/**
 * Registry for managing multiple counters
 */
export class CounterRegistry {
  private readonly counters: Map<string, Counter> = new Map();

  /**
   * Gets or creates a counter
   */
  counter(name: string): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter(name);
      this.counters.set(name, counter);
    }
    return counter;
  }

  /**
   * Gets all counters
   */
  getAll(): readonly Counter[] {
    return [...this.counters.values()];
  }

  /**
   * Gets all counter values across all counters
   */
  getAllValues(): readonly CounterValue[] {
    const result: CounterValue[] = [];
    for (const counter of this.counters.values()) {
      result.push(...counter.getAll());
    }
    return result;
  }

  /**
   * Resets all counters
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
  }
}

// ============================================================================
// GLOBAL COUNTER REGISTRY
// ============================================================================

let globalRegistry: CounterRegistry | null = null;

/**
 * Gets the global counter registry
 */
export function getGlobalCounterRegistry(): CounterRegistry {
  if (!globalRegistry) {
    globalRegistry = new CounterRegistry();
  }
  return globalRegistry;
}

// ============================================================================
// PREDEFINED COUNTERS
// ============================================================================

/**
 * Standard counter names for consistency
 */
export const COUNTER_NAMES = {
  // Workflow counters
  WORKFLOW_STARTED: "workflow_started",
  WORKFLOW_COMPLETED: "workflow_completed",
  WORKFLOW_FAILED: "workflow_failed",

  // Status transition counters
  TRANSITION_ATTEMPTED: "transition_attempted",
  TRANSITION_SUCCEEDED: "transition_succeeded",
  TRANSITION_FAILED: "transition_failed",

  // Error counters
  ERROR_OCCURRED: "error_occurred",
  ERROR_RECOVERED: "error_recovered",

  // Request counters
  REQUEST_RECEIVED: "request_received",
  REQUEST_COMPLETED: "request_completed",

  // Entity counters
  ENTITY_CREATED: "entity_created",
  ENTITY_UPDATED: "entity_updated",
  ENTITY_DELETED: "entity_deleted",
} as const;

/**
 * Increments a workflow started counter
 */
export function countWorkflowStarted(
  workflowType: string,
  traceContext?: TraceContext
): CounterEvent {
  const event = getGlobalCounterRegistry()
    .counter(COUNTER_NAMES.WORKFLOW_STARTED)
    .inc({ workflowType });

  if (traceContext) {
    return { ...event, traceId: traceContext.traceId };
  }
  return event;
}

/**
 * Increments a workflow completed counter
 */
export function countWorkflowCompleted(
  workflowType: string,
  success: boolean,
  traceContext?: TraceContext
): CounterEvent {
  const counterName = success
    ? COUNTER_NAMES.WORKFLOW_COMPLETED
    : COUNTER_NAMES.WORKFLOW_FAILED;

  const event = getGlobalCounterRegistry()
    .counter(counterName)
    .inc({ workflowType });

  if (traceContext) {
    return { ...event, traceId: traceContext.traceId };
  }
  return event;
}

/**
 * Increments a status transition counter
 */
export function countTransition(
  entityType: string,
  fromStatus: string,
  toStatus: string,
  success: boolean,
  traceContext?: TraceContext
): CounterEvent {
  const counterName = success
    ? COUNTER_NAMES.TRANSITION_SUCCEEDED
    : COUNTER_NAMES.TRANSITION_FAILED;

  const event = getGlobalCounterRegistry()
    .counter(counterName)
    .inc({ entityType, fromStatus, toStatus });

  if (traceContext) {
    return { ...event, traceId: traceContext.traceId };
  }
  return event;
}

/**
 * Increments an error occurred counter
 */
export function countError(
  errorCode: string,
  component: string,
  traceContext?: TraceContext
): CounterEvent {
  const event = getGlobalCounterRegistry()
    .counter(COUNTER_NAMES.ERROR_OCCURRED)
    .inc({ errorCode, component });

  if (traceContext) {
    return { ...event, traceId: traceContext.traceId };
  }
  return event;
}
