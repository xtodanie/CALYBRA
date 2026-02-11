/**
 * Real-time Progress Streaming
 *
 * INVARIANT: Streaming never blocks workflow execution
 * INVARIANT: Subscriber failures are isolated
 * INVARIANT: All events include correlation IDs
 *
 * Provides EventEmitter + Observable patterns for real-time
 * visibility into workflow progress without polling.
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";

// ============================================================================
// EVENT TYPES
// ============================================================================

export type ProgressEventType =
  | "workflow:start"
  | "workflow:step"
  | "workflow:complete"
  | "workflow:error"
  | "transition:attempt"
  | "transition:complete"
  | "operation:start"
  | "operation:complete"
  | "metric:timing"
  | "debug:info";

export interface ProgressEvent {
  type: ProgressEventType;
  timestamp: number;
  traceId: string;
  workflowExecutionId?: string;
  tenantId?: string;
  userId?: string;
  payload: ProgressPayload;
}

export type ProgressPayload =
  | WorkflowStartPayload
  | WorkflowStepPayload
  | WorkflowCompletePayload
  | WorkflowErrorPayload
  | TransitionAttemptPayload
  | TransitionCompletePayload
  | OperationStartPayload
  | OperationCompletePayload
  | MetricTimingPayload
  | DebugInfoPayload;

export interface WorkflowStartPayload {
  type: "workflow:start";
  workflowType: string;
  input: Record<string, unknown>;
  totalSteps?: number;
}

export interface WorkflowStepPayload {
  type: "workflow:step";
  stepNumber: number;
  stepName: string;
  status: "in-progress" | "completed" | "skipped";
  detail?: string;
  progress?: number; // 0-100
}

export interface WorkflowCompletePayload {
  type: "workflow:complete";
  success: boolean;
  durationMs: number;
  result?: unknown;
}

export interface WorkflowErrorPayload {
  type: "workflow:error";
  errorType: string;
  message: string;
  recoverable: boolean;
  step?: string;
}

export interface TransitionAttemptPayload {
  type: "transition:attempt";
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
}

export interface TransitionCompletePayload {
  type: "transition:complete";
  entityType: string;
  entityId: string;
  fromStatus: string;
  toStatus: string;
  success: boolean;
  durationMs: number;
}

export interface OperationStartPayload {
  type: "operation:start";
  operation: string;
  component: string;
}

export interface OperationCompletePayload {
  type: "operation:complete";
  operation: string;
  component: string;
  success: boolean;
  durationMs: number;
}

export interface MetricTimingPayload {
  type: "metric:timing";
  name: string;
  valueMs: number;
  budget?: number;
  overBudget?: boolean;
}

export interface DebugInfoPayload {
  type: "debug:info";
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================================================
// SUBSCRIBER TYPES
// ============================================================================

export type ProgressSubscriber = (event: ProgressEvent) => void;
export type Unsubscribe = () => void;

export interface ProgressFilter {
  types?: ProgressEventType[];
  traceIds?: string[];
  workflowIds?: string[];
  tenantIds?: string[];
}

// ============================================================================
// PROGRESS STREAM
// ============================================================================

/**
 * Real-time progress event stream
 * Implements pub/sub pattern with isolated subscriber failure handling
 */
export class ProgressStream {
  private subscribers = new Map<symbol, { fn: ProgressSubscriber; filter?: ProgressFilter }>();
  private buffer: ProgressEvent[] = [];
  private bufferSize: number;
  private debugMode = false;

  constructor(options: { bufferSize?: number; debugMode?: boolean } = {}) {
    this.bufferSize = options.bufferSize ?? 1000;
    this.debugMode = options.debugMode ?? false;
  }

  /**
   * Subscribe to progress events
   * INVARIANT: Returns unsubscribe function for cleanup
   */
  subscribe(subscriber: ProgressSubscriber, filter?: ProgressFilter): Unsubscribe {
    const id = Symbol("subscriber");
    this.subscribers.set(id, { fn: subscriber, filter });

    return () => {
      this.subscribers.delete(id);
    };
  }

  /**
   * Emit a progress event
   * INVARIANT: Never throws, never blocks
   */
  emit(event: ProgressEvent): void {
    // Buffer for replay/debugging
    this.buffer.push(event);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Notify subscribers with isolation
    for (const [, sub] of this.subscribers) {
      if (this.matchesFilter(event, sub.filter)) {
        try {
          sub.fn(event);
        } catch (error) {
          // Subscriber failure must not affect other subscribers or business logic
          if (this.debugMode) {
            console.error("[ProgressStream] Subscriber error:", error);
          }
        }
      }
    }
  }

  /**
   * Get buffered events for replay/debugging
   */
  getBuffer(filter?: ProgressFilter): readonly ProgressEvent[] {
    if (!filter) return this.buffer;
    return this.buffer.filter((e) => this.matchesFilter(e, filter));
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  private matchesFilter(event: ProgressEvent, filter?: ProgressFilter): boolean {
    if (!filter) return true;

    if (filter.types && !filter.types.includes(event.type)) return false;
    if (filter.traceIds && !filter.traceIds.includes(event.traceId)) return false;
    if (filter.workflowIds && event.workflowExecutionId && !filter.workflowIds.includes(event.workflowExecutionId)) return false;
    if (filter.tenantIds && event.tenantId && !filter.tenantIds.includes(event.tenantId)) return false;

    return true;
  }
}

// ============================================================================
// EVENT BUILDERS
// ============================================================================

/**
 * Create base event with correlation IDs
 */
function createBaseEvent(
  type: ProgressEventType,
  trace?: TraceContext,
  workflow?: WorkflowContext
): Omit<ProgressEvent, "payload"> {
  return {
    type,
    timestamp: Date.now(),
    traceId: trace?.traceId ?? "unknown",
    workflowExecutionId: workflow?.workflowExecutionId,
    tenantId: trace?.tenantId,
    userId: trace?.actorId,
  };
}

/**
 * Emit workflow start event
 */
export function emitWorkflowStart(
  stream: ProgressStream,
  workflowType: string,
  input: Record<string, unknown>,
  trace?: TraceContext,
  workflow?: WorkflowContext,
  totalSteps?: number
): void {
  stream.emit({
    ...createBaseEvent("workflow:start", trace, workflow),
    payload: { type: "workflow:start", workflowType, input, totalSteps },
  });
}

/**
 * Emit workflow step event
 */
export function emitWorkflowStep(
  stream: ProgressStream,
  stepNumber: number,
  stepName: string,
  status: "in-progress" | "completed" | "skipped",
  trace?: TraceContext,
  workflow?: WorkflowContext,
  options?: { detail?: string; progress?: number }
): void {
  stream.emit({
    ...createBaseEvent("workflow:step", trace, workflow),
    payload: { type: "workflow:step", stepNumber, stepName, status, ...options },
  });
}

/**
 * Emit workflow complete event
 */
export function emitWorkflowComplete(
  stream: ProgressStream,
  success: boolean,
  durationMs: number,
  trace?: TraceContext,
  workflow?: WorkflowContext,
  result?: unknown
): void {
  stream.emit({
    ...createBaseEvent("workflow:complete", trace, workflow),
    payload: { type: "workflow:complete", success, durationMs, result },
  });
}

/**
 * Emit workflow error event
 */
export function emitWorkflowError(
  stream: ProgressStream,
  errorType: string,
  message: string,
  recoverable: boolean,
  trace?: TraceContext,
  workflow?: WorkflowContext,
  step?: string
): void {
  stream.emit({
    ...createBaseEvent("workflow:error", trace, workflow),
    payload: { type: "workflow:error", errorType, message, recoverable, step },
  });
}

/**
 * Emit transition attempt event
 */
export function emitTransitionAttempt(
  stream: ProgressStream,
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  trace?: TraceContext,
  workflow?: WorkflowContext
): void {
  stream.emit({
    ...createBaseEvent("transition:attempt", trace, workflow),
    payload: { type: "transition:attempt", entityType, entityId, fromStatus, toStatus },
  });
}

/**
 * Emit transition complete event
 */
export function emitTransitionComplete(
  stream: ProgressStream,
  entityType: string,
  entityId: string,
  fromStatus: string,
  toStatus: string,
  success: boolean,
  durationMs: number,
  trace?: TraceContext,
  workflow?: WorkflowContext
): void {
  stream.emit({
    ...createBaseEvent("transition:complete", trace, workflow),
    payload: { type: "transition:complete", entityType, entityId, fromStatus, toStatus, success, durationMs },
  });
}

/**
 * Emit operation start event
 */
export function emitOperationStart(
  stream: ProgressStream,
  operation: string,
  component: string,
  trace?: TraceContext,
  workflow?: WorkflowContext
): void {
  stream.emit({
    ...createBaseEvent("operation:start", trace, workflow),
    payload: { type: "operation:start", operation, component },
  });
}

/**
 * Emit operation complete event
 */
export function emitOperationComplete(
  stream: ProgressStream,
  operation: string,
  component: string,
  success: boolean,
  durationMs: number,
  trace?: TraceContext,
  workflow?: WorkflowContext
): void {
  stream.emit({
    ...createBaseEvent("operation:complete", trace, workflow),
    payload: { type: "operation:complete", operation, component, success, durationMs },
  });
}

/**
 * Emit timing metric event
 */
export function emitTimingMetric(
  stream: ProgressStream,
  name: string,
  valueMs: number,
  trace?: TraceContext,
  workflow?: WorkflowContext,
  budget?: number
): void {
  stream.emit({
    ...createBaseEvent("metric:timing", trace, workflow),
    payload: {
      type: "metric:timing",
      name,
      valueMs,
      budget,
      overBudget: budget ? valueMs > budget : undefined,
    },
  });
}

/**
 * Emit debug info event
 */
export function emitDebugInfo(
  stream: ProgressStream,
  category: string,
  message: string,
  trace?: TraceContext,
  workflow?: WorkflowContext,
  data?: Record<string, unknown>
): void {
  stream.emit({
    ...createBaseEvent("debug:info", trace, workflow),
    payload: { type: "debug:info", category, message, data },
  });
}

// ============================================================================
// GLOBAL STREAM SINGLETON
// ============================================================================

let globalStream: ProgressStream | undefined;

/**
 * Get the global progress stream
 */
export function getProgressStream(): ProgressStream {
  if (!globalStream) {
    globalStream = new ProgressStream();
  }
  return globalStream;
}

/**
 * Set the global progress stream (for testing)
 */
export function setProgressStream(stream: ProgressStream): void {
  globalStream = stream;
}
