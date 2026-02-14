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
  IntentContext,
  IntentInput,
  ClassificationResult,
  createIntentClassifier,
} from './intentClassifier';

// Mode Manager
export {
  ModeManager,
  SystemMode,
  ModeTransitionRule,
  ModeContext,
  ModeTransitionLog,
  ModeState,
  createModeManager,
} from './modeManager';

// Envelope Guard
export {
  EnvelopeGuard,
  EnvelopePolicy,
  RiskTier,
  ActionRequest,
  EnvelopeViolation,
  ValidationResult,
  CumulativeState,
  createEnvelopeGuard,
} from './envelopeGuard';

// Command Arbiter
export {
  CommandArbiter,
  PolicyRule,
  PolicyDecision,
  AIRecommendation,
  DecisionContext,
  ArbitrationResult,
  ArbitrationLog,
  DisagreementConfig,
  createCommandArbiter,
} from './commandArbiter';
