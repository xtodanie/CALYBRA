/**
 * Async Context - Zero-plumbing context propagation using AsyncLocalStorage
 *
 * INVARIANT: Context flows automatically through async boundaries
 * INVARIANT: No manual threading of context required
 * INVARIANT: Works with any async pattern (promises, callbacks, timers)
 *
 * This is 2030-tier observability: context just works.
 */

import { AsyncLocalStorage } from "async_hooks";
import { TraceContext, createTraceContext, TraceEntryPoint, ActorType } from "./traceContext";
import { WorkflowContext, createWorkflowContext, WorkflowType, WorkflowInitiator } from "./workflowContext";
import { createLogger } from "../logging/logger";

// ============================================================================
// EXECUTION CONTEXT (combines trace + workflow)
// ============================================================================

/**
 * Complete execution context that flows automatically
 */
export interface ExecutionContext {
  readonly trace: TraceContext;
  readonly workflow?: WorkflowContext;
  readonly baggage: Readonly<Record<string, string>>;
  readonly debugMode: boolean;
}

// ============================================================================
// ASYNC LOCAL STORAGE SINGLETON
// ============================================================================

const asyncLocalStorage = new AsyncLocalStorage<ExecutionContext>();

/**
 * Gets the current execution context (automatically propagated)
 * Returns undefined if not in a traced context
 */
export function getCurrentContext(): ExecutionContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Gets the current trace context or undefined
 */
export function getCurrentTrace(): TraceContext | undefined {
  return asyncLocalStorage.getStore()?.trace;
}

/**
 * Gets the current workflow context or undefined
 */
export function getCurrentWorkflow(): WorkflowContext | undefined {
  return asyncLocalStorage.getStore()?.workflow;
}

/**
 * Gets baggage value by key
 */
export function getBaggage(key: string): string | undefined {
  return asyncLocalStorage.getStore()?.baggage[key];
}

/**
 * Checks if debug mode is enabled for current context
 */
export function isDebugMode(): boolean {
  return asyncLocalStorage.getStore()?.debugMode ?? false;
}

// ============================================================================
// CONTEXT RUNNERS
// ============================================================================

export interface RunInContextOptions {
  entryPoint: TraceEntryPoint;
  tenantId: string;
  actorId?: string;
  actorType?: ActorType;
  workflowType?: WorkflowType;
  workflowInitiator?: WorkflowInitiator;
  entityIds?: string[];
  baggage?: Record<string, string>;
  debugMode?: boolean;
  /** Inherit from existing context if available */
  inherit?: boolean;
}

/**
 * Runs a function with automatic context propagation
 *
 * USAGE:
 * ```typescript
 * const result = await runInContext({
 *   entryPoint: "HTTP_REQUEST",
 *   tenantId: "tenant-1",
 *   workflowType: "FILE_PARSE",
 * }, async () => {
 *   // All async calls inside automatically have context
 *   await parseFile(fileId);
 *   await saveParsedData();
 *   // No manual context passing needed!
 * });
 * ```
 */
export function runInContext<T>(
  options: RunInContextOptions,
  fn: () => T
): T {
  const existingContext = options.inherit ? asyncLocalStorage.getStore() : undefined;

  const trace = existingContext?.trace ?? createTraceContext({
    entryPoint: options.entryPoint,
    tenantId: options.tenantId,
    actorId: options.actorId,
    actorType: options.actorType,
  });

  const workflow = options.workflowType
    ? createWorkflowContext({
        workflowType: options.workflowType,
        initiator: options.workflowInitiator ?? "SERVER",
        tenantId: options.tenantId,
        entityIds: options.entityIds ?? [],
        traceContext: trace,
      })
    : existingContext?.workflow;

  const context: ExecutionContext = {
    trace,
    workflow,
    baggage: Object.freeze({
      ...(existingContext?.baggage ?? {}),
      ...(options.baggage ?? {}),
    }),
    debugMode: options.debugMode ?? existingContext?.debugMode ?? false,
  };

  return asyncLocalStorage.run(context, fn);
}

/**
 * Runs an async function with automatic context propagation
 */
export async function runInContextAsync<T>(
  options: RunInContextOptions,
  fn: () => Promise<T>
): Promise<T> {
  return runInContext(options, fn);
}

/**
 * Adds baggage to the current context
 * Returns a function that runs with the updated context
 */
export function withBaggage<T>(
  baggage: Record<string, string>,
  fn: () => T
): T {
  const existing = asyncLocalStorage.getStore();
  if (!existing) {
    return fn();
  }

  const newContext: ExecutionContext = {
    ...existing,
    baggage: Object.freeze({
      ...existing.baggage,
      ...baggage,
    }),
  };

  return asyncLocalStorage.run(newContext, fn);
}

/**
 * Enables debug mode for the current context
 */
export function withDebugMode<T>(fn: () => T): T {
  const existing = asyncLocalStorage.getStore();
  if (!existing) {
    return fn();
  }

  const newContext: ExecutionContext = {
    ...existing,
    debugMode: true,
  };

  return asyncLocalStorage.run(newContext, fn);
}

/**
 * Forks the current context with a new workflow
 */
export function forkWorkflow<T>(
  workflowType: WorkflowType,
  entityIds: string[],
  fn: () => T
): T {
  const existing = asyncLocalStorage.getStore();
  if (!existing) {
    return fn();
  }

  const workflow = createWorkflowContext({
    workflowType,
    initiator: "SERVER",
    tenantId: existing.trace.tenantId ?? "unknown",
    entityIds,
    traceContext: existing.trace,
  });

  const newContext: ExecutionContext = {
    ...existing,
    workflow,
  };

  return asyncLocalStorage.run(newContext, fn);
}

// ============================================================================
// CONTEXT-AWARE UTILITIES
// ============================================================================

/**
 * Gets context-aware logger (will use current context automatically)
 */
export function getContextLogger(component: string): {
  debug: (operation: string, message: string, data?: Record<string, unknown>) => void;
  info: (operation: string, message: string, data?: Record<string, unknown>) => void;
  warn: (operation: string, message: string, data?: Record<string, unknown>) => void;
  error: (operation: string, message: string, data?: Record<string, unknown>, error?: Error) => void;
} {
  return {
    debug: (operation, message, data) => {
      const ctx = getCurrentContext();
      const logger = createLogger(component, ctx?.trace, ctx?.workflow);
      logger.debug(operation, message, data);
    },
    info: (operation, message, data) => {
      const ctx = getCurrentContext();
      const logger = createLogger(component, ctx?.trace, ctx?.workflow);
      logger.info(operation, message, data);
    },
    warn: (operation, message, data) => {
      const ctx = getCurrentContext();
      const logger = createLogger(component, ctx?.trace, ctx?.workflow);
      logger.warn(operation, message, data);
    },
    error: (operation, message, data, error) => {
      const ctx = getCurrentContext();
      const logger = createLogger(component, ctx?.trace, ctx?.workflow);
      logger.error(operation, message, data, error);
    },
  };
}
