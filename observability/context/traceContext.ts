/**
 * Trace Context - Global execution context for observability
 *
 * INVARIANT: TraceContext is IMMUTABLE once created
 * INVARIANT: TraceContext is generated at system entry ONLY
 * INVARIANT: TraceContext is propagated through all layers
 * INVARIANT: TraceContext is NEVER regenerated mid-flow
 * INVARIANT: TraceContext failures NEVER affect business logic
 */

import { randomBytes } from "crypto";

// ============================================================================
// TRACE CONTEXT TYPES
// ============================================================================

/**
 * Immutable trace context attached to all operations
 */
export interface TraceContext {
  /** Unique trace ID (prefix: tr_) */
  readonly traceId: string;
  /** Optional parent span ID for distributed tracing */
  readonly parentSpanId?: string;
  /** Timestamp when trace was created */
  readonly createdAt: number;
  /** Entry point type */
  readonly entryPoint: TraceEntryPoint;
  /** Tenant ID if known at entry */
  readonly tenantId?: string;
  /** Actor ID if known at entry */
  readonly actorId?: string;
  /** Actor type */
  readonly actorType: ActorType;
}

export type TraceEntryPoint =
  | "HTTP_REQUEST"
  | "CALLABLE_FUNCTION"
  | "BACKGROUND_JOB"
  | "TRIGGER"
  | "SCHEDULED"
  | "UNKNOWN";

export type ActorType = "USER" | "SERVER" | "SYSTEM";

// ============================================================================
// TRACE ID GENERATION
// ============================================================================

/**
 * Generates a unique trace ID
 * Format: tr_{timestamp}_{random}
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(8).toString("hex");
  return `tr_${timestamp}_${random}`;
}

/**
 * Generates a unique span ID
 * Format: sp_{random}
 */
export function generateSpanId(): string {
  return `sp_${randomBytes(6).toString("hex")}`;
}

// ============================================================================
// TRACE CONTEXT FACTORY
// ============================================================================

export interface CreateTraceContextOptions {
  entryPoint: TraceEntryPoint;
  tenantId?: string;
  actorId?: string;
  actorType?: ActorType;
  parentSpanId?: string;
  /** Override trace ID (for propagation only) */
  existingTraceId?: string;
}

/**
 * Creates a new TraceContext at system entry
 *
 * INVARIANT: If existingTraceId is provided, it is preserved (never regenerated)
 */
export function createTraceContext(options: CreateTraceContextOptions): TraceContext {
  return Object.freeze({
    traceId: options.existingTraceId ?? generateTraceId(),
    parentSpanId: options.parentSpanId,
    createdAt: Date.now(),
    entryPoint: options.entryPoint,
    tenantId: options.tenantId,
    actorId: options.actorId,
    actorType: options.actorType ?? "SYSTEM",
  });
}

// ============================================================================
// TRACE CONTEXT PROPAGATION
// ============================================================================

/**
 * Extracts trace context from HTTP headers
 * Returns undefined if no trace context found (caller should create new one)
 */
export function extractTraceFromHeaders(
  headers: Record<string, string | undefined>
): Partial<CreateTraceContextOptions> | undefined {
  const traceId = headers["x-trace-id"];
  const parentSpanId = headers["x-span-id"];
  const tenantId = headers["x-tenant-id"];
  const actorId = headers["x-actor-id"];

  if (!traceId) {
    return undefined;
  }

  return {
    existingTraceId: traceId,
    parentSpanId,
    tenantId,
    actorId,
  };
}

/**
 * Serializes trace context to headers for propagation
 */
export function traceToHeaders(ctx: TraceContext): Record<string, string> {
  const headers: Record<string, string> = {
    "x-trace-id": ctx.traceId,
  };

  if (ctx.parentSpanId) {
    headers["x-span-id"] = ctx.parentSpanId;
  }
  if (ctx.tenantId) {
    headers["x-tenant-id"] = ctx.tenantId;
  }
  if (ctx.actorId) {
    headers["x-actor-id"] = ctx.actorId;
  }

  return headers;
}

// ============================================================================
// TRACE CONTEXT SERIALIZATION
// ============================================================================

/**
 * Serializes trace context to a plain object (for Firestore metadata)
 * INVARIANT: This is metadata only, never used for logic
 */
export function serializeTraceContext(ctx: TraceContext): Record<string, unknown> {
  return {
    traceId: ctx.traceId,
    parentSpanId: ctx.parentSpanId,
    createdAt: ctx.createdAt,
    entryPoint: ctx.entryPoint,
    tenantId: ctx.tenantId,
    actorId: ctx.actorId,
    actorType: ctx.actorType,
  };
}

/**
 * Validates that a string is a valid trace ID format
 */
export function isValidTraceId(id: string): boolean {
  return typeof id === "string" && id.startsWith("tr_") && id.length > 10;
}

// ============================================================================
// NULL TRACE CONTEXT (For Graceful Degradation)
// ============================================================================

/**
 * Returns a null trace context for graceful degradation
 * Used when trace propagation fails - allows operations to continue
 */
export function getNullTraceContext(): TraceContext {
  return Object.freeze({
    traceId: "tr_null_0000000000000000",
    createdAt: 0,
    entryPoint: "UNKNOWN" as TraceEntryPoint,
    actorType: "SYSTEM" as ActorType,
  });
}
