/**
 * ZEREBROX CALYBRA OS - Autopilot Core Skeleton
 * 
 * Foundational control systems for autonomous financial operations.
 * This module provides the core autopilot infrastructure before any
 * advanced AI features are layered on top.
 */

// Intent Classifier
export {
  IntentClassifier,
  IntentCategory,
  createIntentClassifier,
} from './intentClassifier';

export type {
  IntentContext,
  IntentInput,
  ClassificationResult,
} from './intentClassifier';

// Mode Manager
export {
  ModeManager,
  SystemMode,
  createModeManager,
} from './modeManager';

export type {
  ModeTransitionRule,
  ModeContext,
  ModeTransitionLog,
  ModeState,
} from './modeManager';

// Envelope Guard
export {
  EnvelopeGuard,
  RiskTier,
  createEnvelopeGuard,
} from './envelopeGuard';

export type {
  EnvelopePolicy,
  ActionRequest,
  EnvelopeViolation,
  ValidationResult,
  CumulativeState,
} from './envelopeGuard';

// Command Arbiter
export {
  CommandArbiter,
  createCommandArbiter,
} from './commandArbiter';

export type {
  PolicyRule,
  PolicyDecision,
  AIRecommendation,
  DecisionContext,
  ArbitrationResult,
  ArbitrationLog,
  DisagreementConfig,
} from './commandArbiter';
