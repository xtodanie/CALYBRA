/**
 * Context Module - Execution context for observability
 *
 * Exports:
 * - TraceContext: Global execution context
 * - WorkflowContext: Business workflow context
 */

export {
  // Trace Context Types
  type TraceContext,
  type TraceEntryPoint,
  type ActorType,
  type CreateTraceContextOptions,
  // Trace Context Functions
  generateTraceId,
  generateSpanId,
  createTraceContext,
  extractTraceFromHeaders,
  traceToHeaders,
  serializeTraceContext,
  isValidTraceId,
  getNullTraceContext,
} from "./traceContext";

export {
  // Workflow Context Types
  type WorkflowContext,
  type WorkflowType,
  type WorkflowInitiator,
  type CreateWorkflowContextOptions,
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
} from "./workflowContext";

export {
  // Async Context Types
  type ExecutionContext,
  type RunInContextOptions,
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
} from "./asyncContext";
