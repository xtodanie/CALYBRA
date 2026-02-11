/**
 * Tracing Module - Span-based distributed tracing
 *
 * Exports:
 * - Span types and builders
 * - SpanCollector for recording
 * - Trace reconstruction utilities
 */

export {
  // Span Types
  type SpanStatus,
  type SpanKind,
  type Span,
  type SpanEvent,
  type SpanBuilder,
  // Span Functions
  startSpan,
  // Span Collector
  SpanCollector,
  getGlobalSpanCollector,
  recordSpan,
  // Traced Helpers
  tracedAsync,
  tracedSync,
  // Trace Reconstruction
  type TraceTree,
  type SpanNode,
  buildTraceTree,
} from "./tracer";
