/**
 * Tracer - Span-based tracing for distributed operations
 *
 * INVARIANT: Tracing is purely observational
 * INVARIANT: Span failures NEVER affect business logic
 * INVARIANT: Spans NEVER block or gate execution
 */

import { TraceContext, generateSpanId } from "../context/traceContext";

// ============================================================================
// SPAN TYPES
// ============================================================================

/**
 * Span status
 */
export type SpanStatus = "OK" | "ERROR" | "UNSET";

/**
 * Span kind
 */
export type SpanKind = "INTERNAL" | "SERVER" | "CLIENT" | "PRODUCER" | "CONSUMER";

/**
 * Completed span record
 */
export interface Span {
  /** Unique span ID */
  readonly spanId: string;
  /** Parent span ID if nested */
  readonly parentSpanId?: string;
  /** Trace ID from trace context */
  readonly traceId: string;
  /** Operation name */
  readonly operation: string;
  /** Span kind */
  readonly kind: SpanKind;
  /** Start timestamp */
  readonly startTime: number;
  /** End timestamp */
  readonly endTime: number;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Span status */
  readonly status: SpanStatus;
  /** Status message if error */
  readonly statusMessage?: string;
  /** Span attributes */
  readonly attributes: Readonly<Record<string, string | number | boolean>>;
  /** Events during span */
  readonly events: readonly SpanEvent[];
}

/**
 * Event within a span
 */
export interface SpanEvent {
  /** Event name */
  readonly name: string;
  /** Event timestamp */
  readonly timestamp: number;
  /** Event attributes */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/**
 * Active span builder
 */
export interface SpanBuilder {
  /** Set an attribute */
  readonly setAttribute: (key: string, value: string | number | boolean) => SpanBuilder;
  /** Add an event */
  readonly addEvent: (name: string, attributes?: Record<string, string | number | boolean>) => SpanBuilder;
  /** End the span successfully */
  readonly end: () => Span;
  /** End the span with error */
  readonly endWithError: (error: Error | string) => Span;
  /** Get the span ID */
  readonly spanId: string;
  /** Get elapsed time without ending */
  readonly elapsed: () => number;
}

// ============================================================================
// SPAN BUILDER IMPLEMENTATION
// ============================================================================

/**
 * Creates a new span
 *
 * USAGE:
 * ```typescript
 * const span = startSpan("parse_file", traceContext);
 * span.setAttribute("fileId", fileId);
 * try {
 *   await doWork();
 *   span.addEvent("file_read_complete");
 *   const completed = span.end();
 * } catch (error) {
 *   const completed = span.endWithError(error);
 *   throw error; // Re-throw - tracing is observational only
 * }
 * ```
 */
export function startSpan(
  operation: string,
  traceContext: TraceContext,
  kind: SpanKind = "INTERNAL",
  parentSpanId?: string
): SpanBuilder {
  const spanId = generateSpanId();
  const startTime = Date.now();
  const attributes: Record<string, string | number | boolean> = {};
  const events: SpanEvent[] = [];
  let ended = false;
  let completedSpan: Span | null = null;

  const builder: SpanBuilder = {
    spanId,

    setAttribute(key: string, value: string | number | boolean): SpanBuilder {
      if (!ended) {
        attributes[key] = value;
      }
      return builder;
    },

    addEvent(name: string, eventAttributes?: Record<string, string | number | boolean>): SpanBuilder {
      if (!ended) {
        events.push({
          name,
          timestamp: Date.now(),
          attributes: eventAttributes ? Object.freeze({ ...eventAttributes }) : undefined,
        });
      }
      return builder;
    },

    end(): Span {
      if (ended && completedSpan) {
        return completedSpan;
      }

      const endTime = Date.now();
      ended = true;

      completedSpan = Object.freeze({
        spanId,
        parentSpanId: parentSpanId ?? traceContext.parentSpanId,
        traceId: traceContext.traceId,
        operation,
        kind,
        startTime,
        endTime,
        durationMs: endTime - startTime,
        status: "OK" as SpanStatus,
        attributes: Object.freeze({ ...attributes }),
        events: Object.freeze([...events]),
      });

      return completedSpan;
    },

    endWithError(error: Error | string): Span {
      if (ended && completedSpan) {
        return completedSpan;
      }

      const endTime = Date.now();
      ended = true;

      const message = typeof error === "string" ? error : error.message;

      completedSpan = Object.freeze({
        spanId,
        parentSpanId: parentSpanId ?? traceContext.parentSpanId,
        traceId: traceContext.traceId,
        operation,
        kind,
        startTime,
        endTime,
        durationMs: endTime - startTime,
        status: "ERROR" as SpanStatus,
        statusMessage: message,
        attributes: Object.freeze({ ...attributes }),
        events: Object.freeze([...events]),
      });

      return completedSpan;
    },

    elapsed(): number {
      if (ended && completedSpan) {
        return completedSpan.durationMs;
      }
      return Date.now() - startTime;
    },
  };

  return builder;
}

// ============================================================================
// SPAN COLLECTOR
// ============================================================================

/**
 * Collects spans for export or analysis
 */
export class SpanCollector {
  private readonly spans: Span[] = [];
  private readonly maxSpans: number;

  constructor(maxSpans: number = 10000) {
    this.maxSpans = maxSpans;
  }

  /**
   * Records a completed span
   * INVARIANT: NEVER throws
   */
  record(span: Span): void {
    try {
      if (this.spans.length >= this.maxSpans) {
        this.spans.shift();
      }
      this.spans.push(span);
    } catch {
      // Silent failure - observability must not affect business logic
    }
  }

  /**
   * Gets all spans for a trace
   */
  getByTraceId(traceId: string): readonly Span[] {
    return this.spans.filter((s) => s.traceId === traceId);
  }

  /**
   * Gets all spans
   */
  getAll(): readonly Span[] {
    return [...this.spans];
  }

  /**
   * Gets spans by operation
   */
  getByOperation(operation: string): readonly Span[] {
    return this.spans.filter((s) => s.operation === operation);
  }

  /**
   * Clears all spans
   */
  clear(): void {
    this.spans.length = 0;
  }
}

// ============================================================================
// GLOBAL SPAN COLLECTOR
// ============================================================================

let globalSpanCollector: SpanCollector | null = null;

/**
 * Gets the global span collector
 */
export function getGlobalSpanCollector(): SpanCollector {
  if (!globalSpanCollector) {
    globalSpanCollector = new SpanCollector();
  }
  return globalSpanCollector;
}

/**
 * Records a span to the global collector
 */
export function recordSpan(span: Span): void {
  getGlobalSpanCollector().record(span);
}

// ============================================================================
// TRACED FUNCTION HELPERS
// ============================================================================

/**
 * Wraps an async function with span tracing
 *
 * INVARIANT: Function behavior is unchanged
 * INVARIANT: Errors are re-thrown after tracing
 */
export async function tracedAsync<T>(
  operation: string,
  traceContext: TraceContext,
  fn: (span: SpanBuilder) => Promise<T>,
  kind: SpanKind = "INTERNAL"
): Promise<[T, Span]> {
  const span = startSpan(operation, traceContext, kind);

  try {
    const result = await fn(span);
    const completedSpan = span.end();
    recordSpan(completedSpan);
    return [result, completedSpan];
  } catch (error) {
    const completedSpan = span.endWithError(error as Error);
    recordSpan(completedSpan);
    throw error;
  }
}

/**
 * Wraps a sync function with span tracing
 */
export function tracedSync<T>(
  operation: string,
  traceContext: TraceContext,
  fn: (span: SpanBuilder) => T,
  kind: SpanKind = "INTERNAL"
): [T, Span] {
  const span = startSpan(operation, traceContext, kind);

  try {
    const result = fn(span);
    const completedSpan = span.end();
    recordSpan(completedSpan);
    return [result, completedSpan];
  } catch (error) {
    const completedSpan = span.endWithError(error as Error);
    recordSpan(completedSpan);
    throw error;
  }
}

// ============================================================================
// TRACE RECONSTRUCTION
// ============================================================================

/**
 * Reconstructs a trace tree from spans
 */
export interface TraceTree {
  readonly traceId: string;
  readonly rootSpans: readonly SpanNode[];
  readonly totalDurationMs: number;
  readonly spanCount: number;
}

export interface SpanNode {
  readonly span: Span;
  readonly children: readonly SpanNode[];
}

/**
 * Builds a trace tree from collected spans
 */
export function buildTraceTree(traceId: string): TraceTree | null {
  const spans = getGlobalSpanCollector().getByTraceId(traceId);

  if (spans.length === 0) {
    return null;
  }

  // Build parent-child map
  const childrenMap = new Map<string | undefined, Span[]>();
  for (const span of spans) {
    const parentId = span.parentSpanId;
    const children = childrenMap.get(parentId) ?? [];
    children.push(span);
    childrenMap.set(parentId, children);
  }

  // Build tree recursively
  const buildNode = (span: Span): SpanNode => ({
    span,
    children: (childrenMap.get(span.spanId) ?? []).map(buildNode),
  });

  // Find root spans (no parent or parent not in this trace)
  const spanIds = new Set(spans.map((s) => s.spanId));
  const rootSpans = spans.filter(
    (s) => !s.parentSpanId || !spanIds.has(s.parentSpanId)
  );

  // Calculate total duration
  const minStart = Math.min(...spans.map((s) => s.startTime));
  const maxEnd = Math.max(...spans.map((s) => s.endTime));

  return {
    traceId,
    rootSpans: rootSpans.map(buildNode),
    totalDurationMs: maxEnd - minStart,
    spanCount: spans.length,
  };
}
