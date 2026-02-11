/**
 * Transitions Module - Status transition observation
 *
 * Exports:
 * - TransitionObservation types
 * - Observer functions
 * - Timeline and statistics utilities
 */

export {
  // Types
  type ObservedEntityType,
  type TransitionObservation,
  type TransitionActor,
  type TimelineEntry,
  type TransitionStats,
  // Observer Functions
  observeTransition,
  // Collector
  TransitionCollector,
  getGlobalTransitionCollector,
  // Timeline Utilities
  buildStatusTimeline,
  computeTransitionStats,
} from "./observer";
