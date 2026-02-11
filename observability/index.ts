/**
 * Observability Module - Telemetry and instrumentation
 *
 * FUNDAMENTAL INVARIANTS:
 * - Observability is a SHADOW - it watches but never alters
 * - If observability code were removed, system behavior is IDENTICAL
 * - Telemetry failures NEVER affect business logic
 * - No conditional logic in business code based on telemetry
 * - No writes that influence business state
 * - No retries of core logic based on telemetry
 *
 * This module provides:
 * - TraceContext: Global execution context with trace IDs
 * - WorkflowContext: Business workflow execution tracking
 * - Structured Logging: All logs as structured JSON
 * - Metrics: Timers and counters for performance
 * - Tracing: Span-based distributed tracing
 * - Transitions: Status transition observation
 * - Errors: Error telemetry and classification
 * - Streaming: Real-time progress events
 * - Privacy: PII scrubbing utilities
 * - SLO: Performance budget tracking
 * - Export: OTEL-compatible formats
 */

// ============================================================================
// INTERNAL IMPORTS (for convenience utilities)
// ============================================================================

import {
  TraceContext as _TraceContext,
  TraceEntryPoint as _TraceEntryPoint,
  ActorType as _ActorType,
  createTraceContext as _createTraceContext,
} from "./context/traceContext";

import {
  WorkflowContext as _WorkflowContext,
  WorkflowType as _WorkflowType,
  WorkflowInitiator as _WorkflowInitiator,
  createWorkflowContext as _createWorkflowContext,
} from "./context/workflowContext";

import { Logger as _Logger, createLogger as _createLogger } from "./logging/logger";
import { getGlobalTimingCollector as _getGlobalTimingCollector } from "./metrics/timers";
import { getGlobalCounterRegistry as _getGlobalCounterRegistry } from "./metrics/counters";
import { getGlobalSpanCollector as _getGlobalSpanCollector } from "./tracing/tracer";
import { getGlobalTransitionCollector as _getGlobalTransitionCollector } from "./transitions/observer";
import { getGlobalErrorCollector as _getGlobalErrorCollector } from "./errors/telemetry";

// ============================================================================
// CONTEXT EXPORTS
// ============================================================================

export type {
  // Trace Context Types
  TraceContext,
  TraceEntryPoint,
  ActorType,
  CreateTraceContextOptions,
  // Workflow Context Types
  WorkflowContext,
  WorkflowType,
  WorkflowInitiator,
  CreateWorkflowContextOptions,
  // Async Context Types
  ExecutionContext,
  RunInContextOptions,
} from "./context";

export {
  // Trace Context Functions
  generateTraceId,
  generateSpanId,
  createTraceContext,
  extractTraceFromHeaders,
  traceToHeaders,
  serializeTraceContext,
  isValidTraceId,
  getNullTraceContext,
  // Workflow Context Functions
  generateWorkflowExecutionId,
  createWorkflowContext,
  completeWorkflowContext,
  addEntitiesToWorkflowContext,
  serializeWorkflowContext,
  isValidWorkflowExecutionId,
  getWorkflowDuration,
  getWorkflowElapsed,
  getNullWorkflowContext,
  // Async Context Functions
  getCurrentContext,
  getCurrentTrace,
  getCurrentWorkflow,
  getBaggage,
  isDebugMode,
  runInContext,
  runInContextAsync,
  withBaggage,
  withDebugMode,
  forkWorkflow,
  getContextLogger,
} from "./context";

// ============================================================================
// LOGGING EXPORTS
// ============================================================================

export type {
  // Log Schema Types
  LogLevel,
  LogResult,
  LogActor,
  LogError,
  BaseLogEntry,
  LogEntry,
  // Logger Types
  LoggerConfig,
  LogSink,
} from "./logging";

export {
  // Log Schema Functions
  LOG_LEVEL_VALUES,
  createLogEntry,
  isValidLogEntry,
  checkForForbiddenPatterns,
  // Logger Classes and Functions
  Logger,
  BufferedLogger,
  createLogger,
  createNullLogger,
  createBufferedLogger,
} from "./logging";

// ============================================================================
// METRICS EXPORTS
// ============================================================================

export type {
  // Timer Types
  TimingMeasurement,
  Timer,
  TimingStats,
  // Counter Types
  CounterValue,
  CounterEvent,
} from "./metrics";

export {
  // Timer Functions and Classes
  startTimer,
  timedAsync,
  timedSync,
  aggregateTimings,
  TimingCollector,
  getGlobalTimingCollector,
  recordTiming,
  // Counter Functions and Classes
  Counter,
  CounterRegistry,
  getGlobalCounterRegistry,
  COUNTER_NAMES,
  countWorkflowStarted,
  countWorkflowCompleted,
  countTransition,
  countError,
} from "./metrics";

// ============================================================================
// TRACING EXPORTS
// ============================================================================

export type {
  // Span Types
  SpanStatus,
  SpanKind,
  Span,
  SpanEvent,
  SpanBuilder,
  // Trace Reconstruction Types
  TraceTree,
  SpanNode,
} from "./tracing";

export {
  // Span Functions
  startSpan,
  // Collector
  SpanCollector,
  getGlobalSpanCollector,
  recordSpan,
  // Traced Helpers
  tracedAsync,
  tracedSync,
  // Trace Reconstruction
  buildTraceTree,
} from "./tracing";

// ============================================================================
// TRANSITIONS EXPORTS
// ============================================================================

export type {
  // Transition Types
  ObservedEntityType,
  TransitionObservation,
  TransitionActor,
  TimelineEntry,
  TransitionStats,
} from "./transitions";

export {
  // Observer
  observeTransition,
  // Collector
  TransitionCollector,
  getGlobalTransitionCollector,
  // Utilities
  buildStatusTimeline,
  computeTransitionStats,
} from "./transitions";

// ============================================================================
// ERRORS EXPORTS
// ============================================================================

export type {
  // Error Types
  ErrorRecord,
  ErrorSeverity,
  ErrorStats,
} from "./errors";

export {
  // Functions
  classifyErrorSeverity,
  captureError,
  computeErrorStats,
  // Collector
  ErrorCollector,
  getGlobalErrorCollector,
} from "./errors";

// ============================================================================
// STREAMING EXPORTS
// ============================================================================

export type {
  ProgressEventType,
  ProgressEvent,
  ProgressPayload,
  WorkflowStartPayload,
  WorkflowStepPayload,
  WorkflowCompletePayload,
  WorkflowErrorPayload,
  TransitionAttemptPayload,
  TransitionCompletePayload,
  OperationStartPayload,
  OperationCompletePayload,
  MetricTimingPayload,
  DebugInfoPayload,
  ProgressSubscriber,
  Unsubscribe,
  ProgressFilter,
} from "./streaming";

export {
  ProgressStream,
  emitWorkflowStart,
  emitWorkflowStep,
  emitWorkflowComplete,
  emitWorkflowError,
  emitTransitionAttempt,
  emitTransitionComplete,
  emitOperationStart,
  emitOperationComplete,
  emitTimingMetric,
  emitDebugInfo,
  getProgressStream,
  setProgressStream,
} from "./streaming";

// ============================================================================
// PRIVACY EXPORTS
// ============================================================================

export type { ScrubRule, ScrubConfig } from "./privacy";

export {
  scrubValue,
  scrubObject,
  scrubLogPayload,
  scrubErrorDetails,
} from "./privacy";

// ============================================================================
// SLO EXPORTS
// ============================================================================

export type { SloBudget, SloViolation, SloStats } from "./slo";

export { SloTracker, getSloTracker, setSloTracker } from "./slo";

// ============================================================================
// EXPORT FORMAT (OTEL) EXPORTS
// ============================================================================

export type {
  OTelSpan,
  OTelSpanKind,
  OTelAttribute,
  OTelAnyValue,
  OTelSpanEvent,
  OTelStatus,
  OTelResource,
  OTelLogRecord,
  OTelExportBatch,
} from "./export";

export {
  SemanticAttributes,
  spanToOtel,
  logToOtel,
  createExportBatch,
  exportToOtlp,
} from "./export";

// ============================================================================
// CONVENIENCE UTILITIES
// ============================================================================

/**
 * Creates a complete observability context for a request/operation
 */
export function createObservabilityContext(options: {
  entryPoint: _TraceEntryPoint;
  workflowType: _WorkflowType;
  tenantId: string;
  actorId?: string;
  actorType?: _ActorType;
  entityIds?: string[];
  initiator?: _WorkflowInitiator;
}): {
  traceContext: _TraceContext;
  workflowContext: _WorkflowContext;
  logger: _Logger;
} {
  const traceContext = _createTraceContext({
    entryPoint: options.entryPoint,
    tenantId: options.tenantId,
    actorId: options.actorId,
    actorType: options.actorType,
  });

  const workflowContext = _createWorkflowContext({
    workflowType: options.workflowType,
    initiator: options.initiator ?? "SERVER",
    tenantId: options.tenantId,
    entityIds: options.entityIds ?? [],
    traceContext,
  });

  const logger = _createLogger(
    options.workflowType,
    traceContext,
    workflowContext
  );

  return { traceContext, workflowContext, logger };
}

/**
 * Resets all global collectors (for testing)
 */
export function resetAllCollectors(): void {
  _getGlobalTimingCollector().clear();
  _getGlobalCounterRegistry().reset();
  _getGlobalSpanCollector().clear();
  _getGlobalTransitionCollector().clear();
  _getGlobalErrorCollector().clear();
}
