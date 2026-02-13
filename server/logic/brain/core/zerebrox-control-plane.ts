import { z } from "zod";

export type TruthStatus = "confirmed_correct" | "reversed" | "overridden" | "expired";
export type FeedbackSource = "human_override" | "bank_reconciliation" | "invoice_settlement" | "exception_resolution";
export type FeedbackActorType = "human" | "system";
export type AdaptationTier = "nightly" | "weekly";
export type DriftGate = "observe" | "propose" | "hold";
export type AutopilotMode = "Observe" | "Advise" | "Constrained-Act" | "Hold" | "Lockdown";

export interface DecisionRecord {
  readonly decisionId: string;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly policyVersion: string;
  readonly contextHash: string;
  readonly confidenceScore: number;
  readonly financialImpactEstimate: number;
  readonly createdAtIso: string;
}

export interface TruthBindingEvent {
  readonly truthEventId: string;
  readonly decisionId: string;
  readonly tenantId: string;
  readonly status: TruthStatus;
  readonly observedAtIso: string;
  readonly actorId: string;
}

export interface DecisionTruthLink {
  readonly linkId: string;
  readonly decisionId: string;
  readonly truthEventId: string;
  readonly tenantId: string;
  readonly status: TruthStatus;
  readonly linkedAtIso: string;
}

export interface UnifiedFeedbackEvent {
  readonly eventId: string;
  readonly tenantId: string;
  readonly decisionId?: string;
  readonly source: FeedbackSource;
  readonly actorType: FeedbackActorType;
  readonly actorId: string;
  readonly occurredAtIso: string;
  readonly monthKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface DecisionOutcomeSample {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly tp: number;
  readonly fp: number;
  readonly tn: number;
  readonly fn: number;
  readonly driftScore: number;
  readonly roiDelta: number;
}

export interface DecisionScorecard {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly precision: number;
  readonly recall: number;
  readonly falsePositiveRate: number;
  readonly falseNegativeRate: number;
  readonly driftScore: number;
  readonly estimatedRoiDelta: number;
}

export interface ScoringThresholds {
  readonly minPrecision: number;
  readonly minRecall: number;
  readonly maxFalsePositiveRate: number;
  readonly maxFalseNegativeRate: number;
  readonly maxDriftScore: number;
}

export interface ScoringAlert {
  readonly breached: boolean;
  readonly reasons: readonly string[];
}

export interface ProjectionInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly supplierCostCurrentCents: number;
  readonly supplierCostPreviousCents: number;
  readonly supplierFulfilledOrders: number;
  readonly supplierTotalOrders: number;
  readonly exceptionsCount: number;
  readonly previousExceptionsCount: number;
  readonly paymentLagDays: readonly number[];
  readonly reconciledTransactions: number;
  readonly totalTransactions: number;
}

export interface CoreMemoryProjection {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly supplierCostDrift: number;
  readonly supplierReliabilityScore: number;
  readonly exceptionFrequencyTrend: number;
  readonly paymentLagDistribution: {
    readonly p50: number;
    readonly p90: number;
    readonly max: number;
  };
  readonly bankReconciliationStabilityScore: number;
}

export interface RuntimeContextInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly projection: CoreMemoryProjection;
  readonly supplierReliabilityFlags: readonly string[];
  readonly activePolicyVersion: string;
  readonly financialRiskEnvelope: {
    readonly maxExposureCents: number;
    readonly maxRiskScore: number;
  };
  readonly dataOriginIds: readonly string[];
  readonly includeRawHistoricalData?: boolean;
  readonly tokenBudget: number;
}

export interface CompiledRuntimeContext {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly projection: CoreMemoryProjection;
  readonly supplierReliabilityFlags: readonly string[];
  readonly activePolicyVersion: string;
  readonly financialRiskEnvelope: {
    readonly maxExposureCents: number;
    readonly maxRiskScore: number;
  };
}

export interface ContextCompilationLog {
  readonly tokenSize: number;
  readonly dataOriginIds: readonly string[];
  readonly truncated: boolean;
}

export interface HeartbeatInput {
  readonly tenantId: string;
  readonly heartbeatId: string;
  readonly driftScore: number;
  readonly riskExposureScore: number;
  readonly exceptionBacklog: number;
  readonly policyHealthScore: number;
  readonly envelopeVerified: boolean;
}

export interface HeartbeatOutcome {
  readonly heartbeatId: string;
  readonly tenantId: string;
  readonly escalateToAdaptationScheduler: boolean;
  readonly reasons: readonly string[];
}

export interface AdaptationScheduleInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly tier: AdaptationTier;
  readonly driftScore: number;
  readonly tolerance: number;
  readonly moderateMultiplier: number;
}

export interface AdaptationScheduleOutcome {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly tier: AdaptationTier;
  readonly gate: DriftGate;
  readonly recommendedAction: "observe_only" | "propose_policy_delta" | "escalate_hold_mode";
}

export interface ModeTransitionInput {
  readonly currentMode: AutopilotMode;
  readonly targetMode: AutopilotMode;
  readonly scoringStability: number;
  readonly scoringStabilityThreshold: number;
  readonly reason: string;
  readonly triggerCondition: string;
}

export interface ModeTransitionOutcome {
  readonly accepted: boolean;
  readonly nextMode: AutopilotMode;
  readonly reason: string;
  readonly triggerCondition: string;
}

export interface ArbiterInput {
  readonly deterministicAction: string;
  readonly aiRecommendedAction: string;
  readonly hardPolicyAllowedActions: readonly string[];
}

export interface ArbiterOutcome {
  readonly finalAction: string;
  readonly disagreementLogged: boolean;
  readonly aiDiscarded: boolean;
  readonly reason: string;
}

export interface DualPathComparisonInput {
  readonly deterministicScore: number;
  readonly aiScore: number;
  readonly tolerance: number;
}

export interface DualPathComparisonOutcome {
  readonly delta: number;
  readonly withinTolerance: boolean;
  readonly escalationRequired: boolean;
  readonly classification: "minor_variance" | "human_review";
}

export interface EnvelopeLimits {
  readonly financialExposureCapCents: number;
  readonly minConfidence: number;
  readonly maxRiskScore: number;
  readonly maxBlastRadius: number;
  readonly scopeRestriction: "supplier-level" | "month-level";
}

export interface EnvelopeEvaluationInput {
  readonly requestedExposureCents: number;
  readonly confidenceScore: number;
  readonly riskScore: number;
  readonly requestedBlastRadius: number;
  readonly requestedScope: "supplier-level" | "month-level";
  readonly currentMode: AutopilotMode;
}

export interface EnvelopeEvaluationOutcome {
  readonly allowed: boolean;
  readonly downgradedMode: AutopilotMode;
  readonly reasons: readonly string[];
}

export interface PolicyDeltaProposal {
  readonly proposalId: string;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly pendingPolicyVersion: string;
  readonly detectedPattern: string;
  readonly impactSimulation: {
    readonly estimatedRoiDelta: number;
    readonly estimatedRiskDelta: number;
  };
  readonly scoringJustification: DecisionScorecard;
  readonly status: "PENDING_APPROVAL";
}

export interface PolicyVersionRecord {
  readonly version: string;
  readonly activatedAtIso: string;
  readonly activatedBy: string;
  readonly archived: boolean;
}

export interface PolicyActivationOutcome {
  readonly activeVersion: string;
  readonly archivedVersion: string;
  readonly activationDelta: string;
}

export interface PromptRegistryRecord {
  readonly promptId: string;
  readonly version: number;
  readonly hash: string;
  readonly purpose: string;
  readonly allowedScopes: readonly string[];
  readonly expiryReviewDateIso: string;
  readonly content: string;
}

export interface SchemaLockedDecision<T> {
  readonly valid: boolean;
  readonly parsed?: T;
  readonly fallbackDeterministicAction?: string;
  readonly errors: readonly string[];
}

export interface FlightRecorderEntry {
  readonly decisionId: string;
  readonly contextHash: string;
  readonly policyVersion: string;
  readonly projection: CoreMemoryProjection;
  readonly deterministicAction: string;
  readonly aiAction: string;
  readonly whyFired: string;
  readonly changedFromPrevious: readonly string[];
}

export interface CanaryShadowInput {
  readonly candidatePolicyVersion: string;
  readonly baselinePolicyVersion: string;
  readonly regressionPrecisionDelta: number;
  readonly regressionRecallDelta: number;
  readonly maxAllowedPrecisionDrop: number;
  readonly maxAllowedRecallDrop: number;
}

export interface CanaryShadowOutcome {
  readonly approvedForRollout: boolean;
  readonly autoRollback: boolean;
  readonly regressionDelta: {
    readonly precision: number;
    readonly recall: number;
  };
  readonly notificationMessage: string;
}

const AI_DECISION_SCHEMA = z.object({
  action: z.string().min(1),
  confidence: z.number().min(0).max(1),
  rationaleCode: z.string().min(1),
});

function assertIsoString(value: string, fieldName: string): void {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`invalid ISO timestamp for ${fieldName}`);
  }
}

function round4(value: number): number {
  return Number(value.toFixed(4));
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[idx] ?? 0;
}

function estimateTokenSize(value: unknown): number {
  const chars = JSON.stringify(value).length;
  return Math.ceil(chars / 4);
}

export class AppendOnlyDecisionFeedbackLog {
  private readonly decisions: DecisionRecord[] = [];
  private readonly truthLinks: DecisionTruthLink[] = [];
  private readonly feedbackEvents: UnifiedFeedbackEvent[] = [];

  appendDecision(decision: DecisionRecord): void {
    assertIsoString(decision.createdAtIso, "decision.createdAtIso");
    if (this.decisions.some((entry) => entry.decisionId === decision.decisionId)) {
      throw new Error(`decision already exists: ${decision.decisionId}`);
    }
    this.decisions.push(Object.freeze({ ...decision }));
  }

  appendTruthLink(link: DecisionTruthLink): void {
    assertIsoString(link.linkedAtIso, "truthLink.linkedAtIso");
    if (this.truthLinks.some((entry) => entry.linkId === link.linkId)) {
      throw new Error(`truth link already exists: ${link.linkId}`);
    }
    this.truthLinks.push(Object.freeze({ ...link }));
  }

  appendFeedback(event: UnifiedFeedbackEvent): void {
    assertIsoString(event.occurredAtIso, "feedback.occurredAtIso");
    if (this.feedbackEvents.some((entry) => entry.eventId === event.eventId)) {
      throw new Error(`feedback event already exists: ${event.eventId}`);
    }
    this.feedbackEvents.push(Object.freeze({ ...event, payload: { ...event.payload } }));
  }

  listDecisions(tenantId: string): readonly DecisionRecord[] {
    return this.decisions.filter((entry) => entry.tenantId === tenantId);
  }

  listTruthLinks(tenantId: string): readonly DecisionTruthLink[] {
    return this.truthLinks.filter((entry) => entry.tenantId === tenantId);
  }

  listFeedback(tenantId: string): readonly UnifiedFeedbackEvent[] {
    return this.feedbackEvents.filter((entry) => entry.tenantId === tenantId);
  }
}

export function bindDecisionToTruth(input: {
  readonly decision: DecisionRecord;
  readonly truth: TruthBindingEvent;
  readonly linkId: string;
  readonly linkedAtIso: string;
}): DecisionTruthLink {
  assertIsoString(input.linkedAtIso, "linkedAtIso");
  if (input.decision.decisionId !== input.truth.decisionId) {
    throw new Error("decision/truth mismatch");
  }
  if (input.decision.tenantId !== input.truth.tenantId) {
    throw new Error("tenant mismatch while binding truth");
  }
  return Object.freeze({
    linkId: input.linkId,
    decisionId: input.decision.decisionId,
    truthEventId: input.truth.truthEventId,
    tenantId: input.decision.tenantId,
    status: input.truth.status,
    linkedAtIso: input.linkedAtIso,
  });
}

export function normalizeFeedbackEvent(input: {
  readonly eventId: string;
  readonly tenantId: string;
  readonly source: FeedbackSource;
  readonly actorType: FeedbackActorType;
  readonly actorId: string;
  readonly occurredAtIso: string;
  readonly monthKey: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly decisionId?: string;
}): UnifiedFeedbackEvent {
  assertIsoString(input.occurredAtIso, "feedback.occurredAtIso");
  return Object.freeze({
    eventId: input.eventId,
    tenantId: input.tenantId,
    source: input.source,
    actorType: input.actorType,
    actorId: input.actorId,
    occurredAtIso: input.occurredAtIso,
    monthKey: input.monthKey,
    decisionId: input.decisionId,
    payload: { ...input.payload },
  });
}

export function scoreTenantDecisionOutcomes(sample: DecisionOutcomeSample): DecisionScorecard {
  const precisionDen = sample.tp + sample.fp;
  const recallDen = sample.tp + sample.fn;
  const fprDen = sample.fp + sample.tn;
  const fnrDen = sample.fn + sample.tp;
  return {
    tenantId: sample.tenantId,
    monthKey: sample.monthKey,
    precision: round4(precisionDen === 0 ? 0 : sample.tp / precisionDen),
    recall: round4(recallDen === 0 ? 0 : sample.tp / recallDen),
    falsePositiveRate: round4(fprDen === 0 ? 0 : sample.fp / fprDen),
    falseNegativeRate: round4(fnrDen === 0 ? 0 : sample.fn / fnrDen),
    driftScore: round4(sample.driftScore),
    estimatedRoiDelta: round4(sample.roiDelta),
  };
}

export function evaluateScoringThresholds(
  scorecard: DecisionScorecard,
  thresholds: ScoringThresholds
): ScoringAlert {
  const reasons: string[] = [];
  if (scorecard.precision < thresholds.minPrecision) reasons.push("precision below threshold");
  if (scorecard.recall < thresholds.minRecall) reasons.push("recall below threshold");
  if (scorecard.falsePositiveRate > thresholds.maxFalsePositiveRate) reasons.push("false positive rate above threshold");
  if (scorecard.falseNegativeRate > thresholds.maxFalseNegativeRate) reasons.push("false negative rate above threshold");
  if (scorecard.driftScore > thresholds.maxDriftScore) reasons.push("drift score above threshold");
  return { breached: reasons.length > 0, reasons };
}

export function computeCoreMemoryProjection(input: ProjectionInput): CoreMemoryProjection {
  const costBaseline = Math.max(1, input.supplierCostPreviousCents);
  const reliabilityDen = Math.max(1, input.supplierTotalOrders);
  const exceptionBaseline = Math.max(1, input.previousExceptionsCount);
  const reconciliationDen = Math.max(1, input.totalTransactions);
  const lags = [...input.paymentLagDays].sort((a, b) => a - b);
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    supplierCostDrift: round4((input.supplierCostCurrentCents - input.supplierCostPreviousCents) / costBaseline),
    supplierReliabilityScore: round4(input.supplierFulfilledOrders / reliabilityDen),
    exceptionFrequencyTrend: round4((input.exceptionsCount - input.previousExceptionsCount) / exceptionBaseline),
    paymentLagDistribution: {
      p50: percentile(lags, 0.5),
      p90: percentile(lags, 0.9),
      max: lags[lags.length - 1] ?? 0,
    },
    bankReconciliationStabilityScore: round4(input.reconciledTransactions / reconciliationDen),
  };
}

export function compileRuntimeContext(input: RuntimeContextInput): {
  readonly context: CompiledRuntimeContext;
  readonly log: ContextCompilationLog;
} {
  if (input.includeRawHistoricalData) {
    throw new Error("raw historical data injection is forbidden without explicit runtime contract");
  }
  const context: CompiledRuntimeContext = {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    projection: input.projection,
    supplierReliabilityFlags: [...input.supplierReliabilityFlags],
    activePolicyVersion: input.activePolicyVersion,
    financialRiskEnvelope: {
      maxExposureCents: input.financialRiskEnvelope.maxExposureCents,
      maxRiskScore: input.financialRiskEnvelope.maxRiskScore,
    },
  };
  const tokenSize = estimateTokenSize(context);
  const truncated = tokenSize > input.tokenBudget;
  return {
    context,
    log: {
      tokenSize,
      dataOriginIds: [...input.dataOriginIds],
      truncated,
    },
  };
}

export function runTimerHeartbeat(input: HeartbeatInput): HeartbeatOutcome {
  if (!input.envelopeVerified) {
    return {
      heartbeatId: input.heartbeatId,
      tenantId: input.tenantId,
      escalateToAdaptationScheduler: true,
      reasons: ["envelope verification failed"],
    };
  }

  const reasons: string[] = [];
  if (input.driftScore > 0.3) reasons.push("drift threshold breached");
  if (input.riskExposureScore > 0.7) reasons.push("risk exposure breached");
  if (input.exceptionBacklog > 50) reasons.push("exception backlog breached");
  if (input.policyHealthScore < 0.6) reasons.push("policy health degraded");

  return {
    heartbeatId: input.heartbeatId,
    tenantId: input.tenantId,
    escalateToAdaptationScheduler: reasons.length > 0,
    reasons,
  };
}

export function runAdaptationScheduler(input: AdaptationScheduleInput): AdaptationScheduleOutcome {
  const moderateThreshold = input.tolerance * input.moderateMultiplier;
  if (input.driftScore < input.tolerance) {
    return {
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      tier: input.tier,
      gate: "observe",
      recommendedAction: "observe_only",
    };
  }
  if (input.driftScore < moderateThreshold) {
    return {
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      tier: input.tier,
      gate: "propose",
      recommendedAction: "propose_policy_delta",
    };
  }
  return {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    tier: input.tier,
    gate: "hold",
    recommendedAction: "escalate_hold_mode",
  };
}

const ALLOWED_MODE_TRANSITIONS: Record<AutopilotMode, readonly AutopilotMode[]> = {
  Observe: ["Advise", "Hold"],
  Advise: ["Observe", "Constrained-Act", "Hold"],
  "Constrained-Act": ["Advise", "Hold", "Lockdown"],
  Hold: ["Observe", "Advise", "Lockdown"],
  Lockdown: ["Hold"],
};

export function transitionAutopilotMode(input: ModeTransitionInput): ModeTransitionOutcome {
  const allowed = ALLOWED_MODE_TRANSITIONS[input.currentMode].includes(input.targetMode);
  if (!allowed) {
    return {
      accepted: false,
      nextMode: input.currentMode,
      reason: "illegal mode transition",
      triggerCondition: input.triggerCondition,
    };
  }
  if (
    input.currentMode === "Observe" &&
    input.targetMode === "Constrained-Act" &&
    input.scoringStability < input.scoringStabilityThreshold
  ) {
    return {
      accepted: false,
      nextMode: input.currentMode,
      reason: "stability threshold unmet for Observe -> Constrained-Act",
      triggerCondition: input.triggerCondition,
    };
  }
  return {
    accepted: true,
    nextMode: input.targetMode,
    reason: input.reason,
    triggerCondition: input.triggerCondition,
  };
}

export function arbitrateCommand(input: ArbiterInput): ArbiterOutcome {
  const policyAllowsDeterministic = input.hardPolicyAllowedActions.includes(input.deterministicAction);
  if (!policyAllowsDeterministic) {
    return {
      finalAction: "DENY",
      disagreementLogged: true,
      aiDiscarded: true,
      reason: "hard policy denied deterministic action",
    };
  }
  if (!input.hardPolicyAllowedActions.includes(input.aiRecommendedAction)) {
    return {
      finalAction: input.deterministicAction,
      disagreementLogged: true,
      aiDiscarded: true,
      reason: "hard policy denied ai action",
    };
  }
  if (input.aiRecommendedAction !== input.deterministicAction) {
    return {
      finalAction: input.deterministicAction,
      disagreementLogged: true,
      aiDiscarded: true,
      reason: "deterministic/hard-policy path wins on conflict",
    };
  }
  return {
    finalAction: input.deterministicAction,
    disagreementLogged: false,
    aiDiscarded: false,
    reason: "paths agree",
  };
}

export function compareDualPathOutputs(input: DualPathComparisonInput): DualPathComparisonOutcome {
  const delta = round4(Math.abs(input.deterministicScore - input.aiScore));
  const withinTolerance = delta <= input.tolerance;
  return {
    delta,
    withinTolerance,
    escalationRequired: !withinTolerance,
    classification: withinTolerance ? "minor_variance" : "human_review",
  };
}

export function evaluateProtectionEnvelope(
  limits: EnvelopeLimits,
  input: EnvelopeEvaluationInput
): EnvelopeEvaluationOutcome {
  const reasons: string[] = [];
  if (input.requestedExposureCents > limits.financialExposureCapCents) reasons.push("financial exposure cap breached");
  if (input.confidenceScore < limits.minConfidence) reasons.push("confidence threshold breached");
  if (input.riskScore > limits.maxRiskScore) reasons.push("risk classification breached");
  if (input.requestedBlastRadius > limits.maxBlastRadius) reasons.push("blast radius cap breached");
  if (input.requestedScope !== limits.scopeRestriction) reasons.push("scope restriction breached");

  if (reasons.length === 0) {
    return {
      allowed: true,
      downgradedMode: input.currentMode,
      reasons: [],
    };
  }

  const downgradedMode: AutopilotMode = input.currentMode === "Lockdown" ? "Lockdown" : "Hold";
  return {
    allowed: false,
    downgradedMode,
    reasons,
  };
}

export function buildPolicyDeltaProposal(input: {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly pendingPolicyVersion: string;
  readonly detectedPattern: string;
  readonly estimatedRoiDelta: number;
  readonly estimatedRiskDelta: number;
  readonly scorecard: DecisionScorecard;
}): PolicyDeltaProposal {
  return {
    proposalId: `${input.tenantId}:${input.monthKey}:${input.pendingPolicyVersion}`,
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    pendingPolicyVersion: input.pendingPolicyVersion,
    detectedPattern: input.detectedPattern,
    impactSimulation: {
      estimatedRoiDelta: round4(input.estimatedRoiDelta),
      estimatedRiskDelta: round4(input.estimatedRiskDelta),
    },
    scoringJustification: input.scorecard,
    status: "PENDING_APPROVAL",
  };
}

export function activatePolicyVersion(input: {
  readonly activeVersion: PolicyVersionRecord;
  readonly nextVersion: string;
  readonly actorId: string;
  readonly activatedAtIso: string;
}): {
  readonly archived: PolicyVersionRecord;
  readonly activated: PolicyVersionRecord;
  readonly outcome: PolicyActivationOutcome;
} {
  assertIsoString(input.activatedAtIso, "activatedAtIso");
  const archived: PolicyVersionRecord = {
    ...input.activeVersion,
    archived: true,
  };
  const activated: PolicyVersionRecord = {
    version: input.nextVersion,
    activatedAtIso: input.activatedAtIso,
    activatedBy: input.actorId,
    archived: false,
  };
  return {
    archived,
    activated,
    outcome: {
      activeVersion: activated.version,
      archivedVersion: archived.version,
      activationDelta: `${archived.version} -> ${activated.version}`,
    },
  };
}

export function rollbackPolicyVersion(input: {
  readonly currentVersion: PolicyVersionRecord;
  readonly targetVersion: PolicyVersionRecord;
  readonly recalculatedEnvelope: EnvelopeLimits;
}): {
  readonly activeVersion: PolicyVersionRecord;
  readonly envelope: EnvelopeLimits;
} {
  return {
    activeVersion: { ...input.targetVersion, archived: false },
    envelope: { ...input.recalculatedEnvelope },
  };
}

export class PromptGovernanceRegistry {
  private readonly records = new Map<string, PromptRegistryRecord[]>();

  register(record: PromptRegistryRecord): void {
    assertIsoString(record.expiryReviewDateIso, "expiryReviewDateIso");
    const versions = this.records.get(record.promptId) ?? [];
    if (versions.some((entry) => entry.version === record.version)) {
      throw new Error(`prompt version already exists for ${record.promptId} v${record.version}`);
    }
    const next = [...versions, Object.freeze({ ...record, allowedScopes: [...record.allowedScopes] })]
      .sort((left, right) => left.version - right.version);
    this.records.set(record.promptId, next);
  }

  latest(promptId: string): PromptRegistryRecord | undefined {
    const versions = this.records.get(promptId);
    if (!versions || versions.length === 0) {
      return undefined;
    }
    return versions[versions.length - 1];
  }
}

export function evaluateSchemaLockedAIResponse(input: {
  readonly response: unknown;
  readonly deterministicFallbackAction: string;
}): SchemaLockedDecision<z.infer<typeof AI_DECISION_SCHEMA>> {
  const parsed = AI_DECISION_SCHEMA.safeParse(input.response);
  if (!parsed.success) {
    return {
      valid: false,
      fallbackDeterministicAction: input.deterministicFallbackAction,
      errors: parsed.error.issues.map((issue) => `${issue.path.join(".") || "response"}: ${issue.message}`),
    };
  }
  return {
    valid: true,
    parsed: parsed.data,
    errors: [],
  };
}

export function buildFlightRecorderEntry(input: {
  readonly current: {
    readonly decision: DecisionRecord;
    readonly projection: CoreMemoryProjection;
    readonly deterministicAction: string;
    readonly aiAction: string;
    readonly whyFired: string;
  };
  readonly previous?: {
    readonly contextHash: string;
    readonly policyVersion: string;
    readonly deterministicAction: string;
    readonly aiAction: string;
  };
}): FlightRecorderEntry {
  const changes: string[] = [];
  if (input.previous) {
    if (input.previous.contextHash !== input.current.decision.contextHash) changes.push("contextHash");
    if (input.previous.policyVersion !== input.current.decision.policyVersion) changes.push("policyVersion");
    if (input.previous.deterministicAction !== input.current.deterministicAction) changes.push("deterministicAction");
    if (input.previous.aiAction !== input.current.aiAction) changes.push("aiAction");
  }
  return {
    decisionId: input.current.decision.decisionId,
    contextHash: input.current.decision.contextHash,
    policyVersion: input.current.decision.policyVersion,
    projection: input.current.projection,
    deterministicAction: input.current.deterministicAction,
    aiAction: input.current.aiAction,
    whyFired: input.current.whyFired,
    changedFromPrevious: changes,
  };
}

export function evaluateCanaryShadow(input: CanaryShadowInput): CanaryShadowOutcome {
  const precisionDrop = Math.max(0, -input.regressionPrecisionDelta);
  const recallDrop = Math.max(0, -input.regressionRecallDelta);
  const autoRollback =
    precisionDrop > input.maxAllowedPrecisionDrop ||
    recallDrop > input.maxAllowedRecallDrop;

  return {
    approvedForRollout: !autoRollback,
    autoRollback,
    regressionDelta: {
      precision: round4(input.regressionPrecisionDelta),
      recall: round4(input.regressionRecallDelta),
    },
    notificationMessage: autoRollback
      ? `Auto-rollback triggered for ${input.candidatePolicyVersion}; baseline=${input.baselinePolicyVersion}`
      : `Canary approved for ${input.candidatePolicyVersion}`,
  };
}
