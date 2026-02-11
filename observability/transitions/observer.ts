/**
 * Status Transition Observation - Tracks status transitions
 *
 * INVARIANT: Observation is PURELY read-only
 * INVARIANT: NEVER validates transitions (that's statusMachine's job)
 * INVARIANT: NEVER blocks transitions
 * INVARIANT: NEVER retries or fixes transitions
 * INVARIANT: Records transitions AFTER they happen
 */

import { TraceContext } from "../context/traceContext";
import { WorkflowContext } from "../context/workflowContext";

// ============================================================================
// TRANSITION OBSERVATION TYPES
// ============================================================================

/**
 * Entity types with status machines
 */
export type ObservedEntityType =
  | "MONTH_CLOSE"
  | "FILE_ASSET"
  | "MATCH"
  | "PARSE_STATUS";

/**
 * Recorded status transition
 */
export interface TransitionObservation {
  /** Unique observation ID */
  readonly observationId: string;
  /** Entity type */
  readonly entityType: ObservedEntityType;
  /** Entity ID */
  readonly entityId: string;
  /** Tenant ID */
  readonly tenantId: string;
  /** Status before transition */
  readonly fromStatus: string;
  /** Status after transition */
  readonly toStatus: string;
  /** Actor who performed the transition */
  readonly actor: TransitionActor;
  /** Timestamp of observation */
  readonly timestamp: number;
  /** Trace ID for correlation */
  readonly traceId?: string;
  /** Workflow execution ID */
  readonly workflowExecutionId?: string;
  /** Whether the transition succeeded */
  readonly succeeded: boolean;
  /** Error message if failed */
  readonly error?: string;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Actor who performed a transition
 */
export interface TransitionActor {
  /** Actor type */
  readonly type: "USER" | "SERVER" | "SYSTEM";
  /** Actor ID */
  readonly id?: string;
}

// ============================================================================
// TRANSITION OBSERVER
// ============================================================================

let observationCounter = 0;

/**
 * Records a status transition observation
 *
 * USAGE: Call this AFTER a transition succeeds or fails
 * ```typescript
 * // In workflow code, after transition completes:
 * observeTransition({
 *   entityType: "MONTH_CLOSE",
 *   entityId: monthCloseId,
 *   tenantId,
 *   fromStatus: "DRAFT",
 *   toStatus: "IN_REVIEW",
 *   succeeded: true,
 *   traceContext,
 * });
 * ```
 */
export function observeTransition(params: {
  entityType: ObservedEntityType;
  entityId: string;
  tenantId: string;
  fromStatus: string;
  toStatus: string;
  succeeded: boolean;
  error?: string;
  traceContext?: TraceContext;
  workflowContext?: WorkflowContext;
  metadata?: Record<string, unknown>;
}): TransitionObservation {
  const observation: TransitionObservation = Object.freeze({
    observationId: `obs_${Date.now()}_${++observationCounter}`,
    entityType: params.entityType,
    entityId: params.entityId,
    tenantId: params.tenantId,
    fromStatus: params.fromStatus,
    toStatus: params.toStatus,
    actor: {
      type: params.traceContext?.actorType ?? "SYSTEM",
      id: params.traceContext?.actorId,
    },
    timestamp: Date.now(),
    traceId: params.traceContext?.traceId,
    workflowExecutionId: params.workflowContext?.workflowExecutionId,
    succeeded: params.succeeded,
    error: params.error,
    metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
  });

  // Record to global collector
  try {
    getGlobalTransitionCollector().record(observation);
  } catch {
    // Silent failure - observability must not affect business logic
  }

  return observation;
}

// ============================================================================
// TRANSITION COLLECTOR
// ============================================================================

/**
 * Collects transition observations
 */
export class TransitionCollector {
  private readonly observations: TransitionObservation[] = [];
  private readonly maxObservations: number;

  constructor(maxObservations: number = 10000) {
    this.maxObservations = maxObservations;
  }

  /**
   * Records an observation
   * INVARIANT: NEVER throws
   */
  record(observation: TransitionObservation): void {
    try {
      if (this.observations.length >= this.maxObservations) {
        this.observations.shift();
      }
      this.observations.push(observation);
    } catch {
      // Silent failure
    }
  }

  /**
   * Gets observations by entity
   */
  getByEntity(entityType: ObservedEntityType, entityId: string): readonly TransitionObservation[] {
    return this.observations.filter(
      (o) => o.entityType === entityType && o.entityId === entityId
    );
  }

  /**
   * Gets observations by trace ID
   */
  getByTraceId(traceId: string): readonly TransitionObservation[] {
    return this.observations.filter((o) => o.traceId === traceId);
  }

  /**
   * Gets observations by tenant
   */
  getByTenant(tenantId: string): readonly TransitionObservation[] {
    return this.observations.filter((o) => o.tenantId === tenantId);
  }

  /**
   * Gets failed transitions
   */
  getFailed(): readonly TransitionObservation[] {
    return this.observations.filter((o) => !o.succeeded);
  }

  /**
   * Gets all observations
   */
  getAll(): readonly TransitionObservation[] {
    return [...this.observations];
  }

  /**
   * Gets transition history for an entity
   */
  getEntityHistory(
    entityType: ObservedEntityType,
    entityId: string
  ): readonly TransitionObservation[] {
    return [...this.getByEntity(entityType, entityId)].sort(
      (a, b) => a.timestamp - b.timestamp
    );
  }

  /**
   * Gets transition timeline for a workflow
   */
  getWorkflowTimeline(workflowExecutionId: string): readonly TransitionObservation[] {
    return this.observations
      .filter((o) => o.workflowExecutionId === workflowExecutionId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clears all observations
   */
  clear(): void {
    this.observations.length = 0;
  }
}

// ============================================================================
// GLOBAL COLLECTOR
// ============================================================================

let globalTransitionCollector: TransitionCollector | null = null;

/**
 * Gets the global transition collector
 */
export function getGlobalTransitionCollector(): TransitionCollector {
  if (!globalTransitionCollector) {
    globalTransitionCollector = new TransitionCollector();
  }
  return globalTransitionCollector;
}

// ============================================================================
// TRANSITION TIMELINE UTILITIES
// ============================================================================

/**
 * Status timeline entry
 */
export interface TimelineEntry {
  readonly status: string;
  readonly enteredAt: number;
  readonly exitedAt?: number;
  readonly durationMs?: number;
  readonly transitionedBy: TransitionActor;
}

/**
 * Builds a status timeline from observations
 */
export function buildStatusTimeline(
  observations: readonly TransitionObservation[]
): readonly TimelineEntry[] {
  if (observations.length === 0) {
    return [];
  }

  const sorted = [...observations]
    .filter((o) => o.succeeded)
    .sort((a, b) => a.timestamp - b.timestamp);

  const timeline: TimelineEntry[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    // Entry for the source status
    if (i === 0) {
      timeline.push({
        status: current.fromStatus,
        enteredAt: 0, // Unknown when original status was entered
        exitedAt: current.timestamp,
        durationMs: undefined, // Unknown
        transitionedBy: { type: "SYSTEM" },
      });
    }

    // Entry for the destination status
    timeline.push({
      status: current.toStatus,
      enteredAt: current.timestamp,
      exitedAt: next?.timestamp,
      durationMs: next ? next.timestamp - current.timestamp : undefined,
      transitionedBy: current.actor,
    });
  }

  return timeline;
}

// ============================================================================
// TRANSITION STATISTICS
// ============================================================================

/**
 * Transition statistics
 */
export interface TransitionStats {
  readonly entityType: ObservedEntityType;
  readonly totalTransitions: number;
  readonly successfulTransitions: number;
  readonly failedTransitions: number;
  readonly successRate: number;
  readonly transitionCounts: Readonly<Record<string, number>>;
  readonly avgDurationMs?: number;
}

/**
 * Computes statistics from observations
 */
export function computeTransitionStats(
  observations: readonly TransitionObservation[]
): TransitionStats | null {
  if (observations.length === 0) {
    return null;
  }

  const entityType = observations[0].entityType;
  const successful = observations.filter((o) => o.succeeded);
  const transitionCounts: Record<string, number> = {};

  for (const obs of observations) {
    const key = `${obs.fromStatus}->${obs.toStatus}`;
    transitionCounts[key] = (transitionCounts[key] ?? 0) + 1;
  }

  return {
    entityType,
    totalTransitions: observations.length,
    successfulTransitions: successful.length,
    failedTransitions: observations.length - successful.length,
    successRate: successful.length / observations.length,
    transitionCounts: Object.freeze(transitionCounts),
  };
}
