/**
 * Metrics Module - Timers and counters for observability
 *
 * Exports:
 * - Timer implementation for wall-clock timing
 * - Counter implementation for occurrence tracking
 * - Aggregation utilities
 */

export {
  // Timer Types
  type TimingMeasurement,
  type Timer,
  type TimingStats,
  // Timer Functions
  startTimer,
  timedAsync,
  timedSync,
  aggregateTimings,
  // Timer Collector
  TimingCollector,
  getGlobalTimingCollector,
  recordTiming,
} from "./timers";

export {
  // Counter Types
  type CounterValue,
  type CounterEvent,
  // Counter Classes
  Counter,
  CounterRegistry,
  // Global Registry
  getGlobalCounterRegistry,
  // Counter Names
  COUNTER_NAMES,
  // Counter Helpers
  countWorkflowStarted,
  countWorkflowCompleted,
  countTransition,
  countError,
} from "./counters";
