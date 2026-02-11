/**
 * Errors Module - Error telemetry
 *
 * Exports:
 * - ErrorRecord types
 * - Error capture functions
 * - Error statistics utilities
 */

export {
  // Types
  type ErrorRecord,
  type ErrorSeverity,
  type ErrorStats,
  // Functions
  classifyErrorSeverity,
  captureError,
  computeErrorStats,
  // Collector
  ErrorCollector,
  getGlobalErrorCollector,
} from "./telemetry";
