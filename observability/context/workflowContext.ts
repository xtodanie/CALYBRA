/**
 * Workflow Context - Execution context for business workflows
 *
 * INVARIANT: WorkflowContext is metadata ONLY, never authoritative state
 * INVARIANT: WorkflowContext is not persisted as business state
 * INVARIANT: WorkflowContext can span multiple requests
 * INVARIANT: WorkflowContext failures NEVER affect business logic
 */

import { randomBytes } from "crypto";
import { TraceContext } from "./traceContext";

// ============================================================================
// WORKFLOW CONTEXT TYPES
// ============================================================================

/**
 * Types of workflows in the system
 */
export type WorkflowType =
  | "FILE_UPLOAD"
  | "FILE_PARSE"
  | "MATCHING"
  | "MATCH_CONFIRM"
  | "MATCH_REJECT"
  | "INVOICE_CREATE"
  | "MONTH_CLOSE_TRANSITION"
  | "MONTH_CLOSE_FINALIZE"
  | "BATCH_RECONCILIATION"
  | "UNKNOWN";

/**
 * Workflow initiator type
 */
export type WorkflowInitiator = "USER" | "SERVER" | "SCHEDULED";

/**
 * Workflow execution context
 * Represents one logical business flow that may span multiple requests
 */
export interface WorkflowContext {
  /** Unique workflow execution ID (prefix: wf_) */
  readonly workflowExecutionId: string;
  /** Type of workflow */
  readonly workflowType: WorkflowType;
  /** Who initiated this workflow */
  readonly initiator: WorkflowInitiator;
  /** Tenant scope */
  readonly tenantId: string;
  /** Entity IDs involved in this workflow */
  readonly entityIds: readonly string[];
  /** Workflow start time */
  readonly startTime: number;
  /** Workflow end time (undefined if still running) */
  readonly endTime?: number;
  /** Parent trace context */
  readonly traceContext: TraceContext;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// WORKFLOW ID GENERATION
// ============================================================================

/**
 * Generates a unique workflow execution ID
 * Format: wf_{workflowType}_{timestamp}_{random}
 */
export function generateWorkflowExecutionId(workflowType: WorkflowType): string {
  const typePrefix = workflowType.toLowerCase().replace(/_/g, "");
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString("hex");
  return `wf_${typePrefix}_${timestamp}_${random}`;
}

// ============================================================================
// WORKFLOW CONTEXT FACTORY
// ============================================================================

export interface CreateWorkflowContextOptions {
  workflowType: WorkflowType;
  initiator: WorkflowInitiator;
  tenantId: string;
  entityIds: readonly string[];
  traceContext: TraceContext;
  metadata?: Record<string, unknown>;
  /** Override execution ID (for continuation only) */
  existingExecutionId?: string;
}

/**
 * Creates a new WorkflowContext
 *
 * INVARIANT: If existingExecutionId is provided, it is preserved
 */
export function createWorkflowContext(options: CreateWorkflowContextOptions): WorkflowContext {
  return Object.freeze({
    workflowExecutionId: options.existingExecutionId ?? generateWorkflowExecutionId(options.workflowType),
    workflowType: options.workflowType,
    initiator: options.initiator,
    tenantId: options.tenantId,
    entityIds: Object.freeze([...options.entityIds]),
    startTime: Date.now(),
    endTime: undefined,
    traceContext: options.traceContext,
    metadata: options.metadata ? Object.freeze({ ...options.metadata }) : undefined,
  });
}

/**
 * Marks a workflow as completed
 * Returns a new immutable context with endTime set
 */
export function completeWorkflowContext(ctx: WorkflowContext): WorkflowContext {
  return Object.freeze({
    ...ctx,
    endTime: Date.now(),
  });
}

/**
 * Adds entity IDs to the workflow context
 * Returns a new immutable context with updated entityIds
 */
export function addEntitiesToWorkflowContext(
  ctx: WorkflowContext,
  newEntityIds: readonly string[]
): WorkflowContext {
  const combined = [...new Set([...ctx.entityIds, ...newEntityIds])];
  return Object.freeze({
    ...ctx,
    entityIds: Object.freeze(combined),
  });
}

// ============================================================================
// WORKFLOW CONTEXT SERIALIZATION
// ============================================================================

/**
 * Serializes workflow context to a plain object (for logging/storage)
 * INVARIANT: This is metadata only, never used for logic
 */
export function serializeWorkflowContext(ctx: WorkflowContext): Record<string, unknown> {
  return {
    workflowExecutionId: ctx.workflowExecutionId,
    workflowType: ctx.workflowType,
    initiator: ctx.initiator,
    tenantId: ctx.tenantId,
    entityIds: [...ctx.entityIds],
    startTime: ctx.startTime,
    endTime: ctx.endTime,
    traceId: ctx.traceContext.traceId,
    metadata: ctx.metadata ? { ...ctx.metadata } : undefined,
  };
}

/**
 * Validates that a string is a valid workflow execution ID format
 */
export function isValidWorkflowExecutionId(id: string): boolean {
  return typeof id === "string" && id.startsWith("wf_") && id.length > 15;
}

// ============================================================================
// WORKFLOW DURATION
// ============================================================================

/**
 * Calculates workflow duration in milliseconds
 * Returns undefined if workflow is still running
 */
export function getWorkflowDuration(ctx: WorkflowContext): number | undefined {
  if (ctx.endTime === undefined) {
    return undefined;
  }
  return ctx.endTime - ctx.startTime;
}

/**
 * Calculates elapsed time since workflow started
 */
export function getWorkflowElapsed(ctx: WorkflowContext): number {
  const end = ctx.endTime ?? Date.now();
  return end - ctx.startTime;
}

// ============================================================================
// NULL WORKFLOW CONTEXT (For Graceful Degradation)
// ============================================================================

/**
 * Returns a null workflow context for graceful degradation
 */
export function getNullWorkflowContext(traceContext: TraceContext): WorkflowContext {
  return Object.freeze({
    workflowExecutionId: "wf_null_0000000000000000",
    workflowType: "UNKNOWN" as WorkflowType,
    initiator: "SYSTEM" as WorkflowInitiator,
    tenantId: "unknown",
    entityIds: Object.freeze([]),
    startTime: 0,
    endTime: undefined,
    traceContext,
  });
}
