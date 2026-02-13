import { Firestore, Timestamp } from "firebase-admin/firestore";
import {
  readBrainArtifactsByMonth,
  readReadmodelItem,
  readReadmodelSnapshot,
} from "../persistence/read";
import {
  mergeReadmodelDoc,
  createEvent,
  writeReadmodel,
  writeReadmodelDoc,
} from "../persistence/write";
import {
  activatePolicyVersion,
  arbitrateCommand,
  bindDecisionToTruth,
  buildFlightRecorderEntry,
  buildPolicyDeltaProposal,
  compareDualPathOutputs,
  compileRuntimeContext,
  computeCoreMemoryProjection,
  evaluateCanaryShadow,
  evaluateExecutionBudget,
  evaluatePolicyShadowDecision,
  evaluateProtectionEnvelope,
  evaluateScoringThresholds,
  evaluateSchemaLockedAIResponse,
  createQuarantineEnvelope,
  replayQuarantinedEnvelope,
  normalizeFeedbackEvent,
  runAdaptationScheduler,
  runTimerHeartbeat,
  scoreTenantDecisionOutcomes,
  summarizePolicyShadow,
  transitionAutopilotMode,
  type AdaptationTier,
  type DecisionRecord,
  type FlightRecorderEntry,
} from "../logic/brain";

export interface ZerebroxHeartbeatInput {
  readonly tenantId: string;
  readonly monthKey: string;
  readonly now: Timestamp;
  readonly actorId: string;
  readonly tier: AdaptationTier;
}

export interface ZerebroxHeartbeatOutcome {
  readonly success: true;
  readonly tenantId: string;
  readonly monthKey: string;
  readonly heartbeatId: string;
  readonly escalated: boolean;
  readonly adaptationGate: "observe" | "propose" | "hold";
  readonly budgetCircuitBroken: boolean;
  readonly shadowDisagreement: boolean;
  readonly recorderPath: string;
}

export interface ZerebroxDeadLetterReplayInput {
  readonly tenantId: string;
  readonly quarantineId: string;
  readonly actorId: string;
  readonly now: Timestamp;
  readonly maxReplayAttempts?: number;
}

export interface ZerebroxDeadLetterReplayOutcome {
  readonly tenantId: string;
  readonly quarantineId: string;
  readonly status: "QUARANTINED" | "REPLAYED" | "FAILED";
  readonly replayAttempts: number;
  readonly reasonCode: "REPLAY_OK" | "REPLAY_HASH_MISMATCH" | "REPLAY_VALIDATION_FAILED";
}

export interface ZerebroxPolicyApprovalInput {
  readonly tenantId: string;
  readonly proposalId: string;
  readonly actorId: string;
  readonly now: Timestamp;
  readonly candidatePolicyVersion: string;
  readonly baselinePolicyVersion: string;
  readonly regressionPrecisionDelta: number;
  readonly regressionRecallDelta: number;
}

function latestArtifactByType(
  artifacts: readonly Record<string, unknown>[],
  type: string
): Record<string, unknown> | undefined {
  const candidates = artifacts.filter((artifact) => artifact["type"] === type);
  return candidates[candidates.length - 1];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function toDecisionRecord(params: {
  tenantId: string;
  monthKey: string;
  policyVersion: string;
  generatedAtIso: string;
  decisionPayload: Record<string, unknown>;
}): DecisionRecord {
  const replayHash = typeof params.decisionPayload["replayHash"] === "string"
    ? (params.decisionPayload["replayHash"] as string)
    : `ctx:${params.monthKey}`;
  const accepted = params.decisionPayload["accepted"] === true;
  return {
    decisionId: `decision:${params.monthKey}:${replayHash.slice(0, 12)}`,
    tenantId: params.tenantId,
    monthKey: params.monthKey,
    policyVersion: params.policyVersion,
    contextHash: replayHash,
    confidenceScore: accepted ? 0.86 : 0.52,
    financialImpactEstimate: accepted ? 1200 : -300,
    createdAtIso: params.generatedAtIso,
  };
}

function buildRecorderSnapshot(input: {
  tenantId: string;
  monthKey: string;
  nowIso: string;
  policyVersion: string;
  previous?: FlightRecorderEntry;
  artifacts: readonly Record<string, unknown>[];
}): { recorder: FlightRecorderEntry; projection: ReturnType<typeof computeCoreMemoryProjection> } {
  const decisionArtifact = latestArtifactByType(input.artifacts, "decision");
  const healthArtifact = latestArtifactByType(input.artifacts, "health");
  const gateArtifact = latestArtifactByType(input.artifacts, "gate_audit");
  const decisionPayload = asRecord(decisionArtifact?.["payload"]);
  const healthPayload = asRecord(healthArtifact?.["payload"]);
  const gatePayload = asRecord(gateArtifact?.["payload"]);

  const eventsApplied = typeof healthPayload["eventsApplied"] === "number"
    ? (healthPayload["eventsApplied"] as number)
    : 0;
  const healthIndex = typeof healthPayload["healthIndex"] === "number"
    ? (healthPayload["healthIndex"] as number)
    : 0.5;

  const projection = computeCoreMemoryProjection({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    supplierCostCurrentCents: 100000 + eventsApplied * 100,
    supplierCostPreviousCents: 100000,
    supplierFulfilledOrders: Math.max(1, Math.round(90 + healthIndex * 10)),
    supplierTotalOrders: 100,
    exceptionsCount: Math.max(0, Math.round((1 - healthIndex) * 20)),
    previousExceptionsCount: 8,
    paymentLagDays: [1, 2, 3, 4, 7],
    reconciledTransactions: Math.round(80 + healthIndex * 20),
    totalTransactions: 100,
  });

  const decision = toDecisionRecord({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    policyVersion: input.policyVersion,
    generatedAtIso: input.nowIso,
    decisionPayload,
  });

  const deterministicAction = decisionPayload["accepted"] === true ? "APPLY_POLICY_RECOMMENDATION" : "HOLD_POLICY";
  const aiAction = gatePayload["accepted"] === true ? deterministicAction : "RULE_ONLY_FALLBACK";
  const recorder = buildFlightRecorderEntry({
    current: {
      decision,
      projection,
      deterministicAction,
      aiAction,
      whyFired: gatePayload["accepted"] === true ? "gate accepted" : "gate denied",
    },
    previous: input.previous
      ? {
          contextHash: input.previous.contextHash,
          policyVersion: input.previous.policyVersion,
          deterministicAction: input.previous.deterministicAction,
          aiAction: input.previous.aiAction,
        }
      : undefined,
  });

  return { recorder, projection };
}

export async function runZerebroxControlPlaneHeartbeatWorkflow(
  db: Firestore,
  input: ZerebroxHeartbeatInput,
): Promise<ZerebroxHeartbeatOutcome> {
  const nowIso = input.now.toDate().toISOString();
  const heartbeatId = `hb:${input.tenantId}:${input.monthKey}:${input.now.toMillis()}`;
  const artifacts = await readBrainArtifactsByMonth(db, input.tenantId, input.monthKey);

  const activePolicyDoc = await readReadmodelItem(db, input.tenantId, "policyVersions", "active");
  const policyVersion = typeof activePolicyDoc?.["activeVersion"] === "string"
    ? (activePolicyDoc["activeVersion"] as string)
    : "pv-1";

  const budgetConfigDoc = await readReadmodelItem(db, input.tenantId, "zerebroxExecutionBudget", "active");
  const executionBudget = {
    maxTokens: typeof budgetConfigDoc?.["maxTokens"] === "number"
      ? (budgetConfigDoc["maxTokens"] as number)
      : 1200,
    maxDurationMs: typeof budgetConfigDoc?.["maxDurationMs"] === "number"
      ? (budgetConfigDoc["maxDurationMs"] as number)
      : 1500,
    maxCostMicros: typeof budgetConfigDoc?.["maxCostMicros"] === "number"
      ? (budgetConfigDoc["maxCostMicros"] as number)
      : 50000,
  };

  const shadowConfigDoc = await readReadmodelItem(db, input.tenantId, "policyShadowConfig", "active");
  const policyShadowEnabled = shadowConfigDoc?.["enabled"] === true;
  const shadowMinConfidence = typeof shadowConfigDoc?.["candidateMinConfidence"] === "number"
    ? (shadowConfigDoc["candidateMinConfidence"] as number)
    : 0.65;
  const shadowMaxRiskScore = typeof shadowConfigDoc?.["candidateMaxRiskScore"] === "number"
    ? (shadowConfigDoc["candidateMaxRiskScore"] as number)
    : 0.65;

  const recorderSnapshot = await readReadmodelSnapshot(db, input.tenantId, "flightRecorder", input.monthKey);
  const previousTimeline = Array.isArray(recorderSnapshot?.["timeline"]) ? (recorderSnapshot?.["timeline"] as FlightRecorderEntry[]) : [];
  const previousEntry = previousTimeline.length > 0 ? previousTimeline[previousTimeline.length - 1] : undefined;
  const shadowSummarySnapshot = await readReadmodelSnapshot(db, input.tenantId, "policyShadow", "summary");
  const previousShadowOutcomes = Array.isArray(shadowSummarySnapshot?.["outcomes"])
    ? (shadowSummarySnapshot["outcomes"] as ReturnType<typeof evaluatePolicyShadowDecision>[])
    : [];

  const { recorder, projection } = buildRecorderSnapshot({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    nowIso,
    policyVersion,
    previous: previousEntry,
    artifacts,
  });

  const compiled = compileRuntimeContext({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    projection,
    supplierReliabilityFlags: [`reliability:${projection.supplierReliabilityScore}`],
    activePolicyVersion: policyVersion,
    financialRiskEnvelope: { maxExposureCents: 250000, maxRiskScore: 0.7 },
    dataOriginIds: [`brainArtifacts:${input.monthKey}`, `policyVersion:${policyVersion}`],
    tokenBudget: 1200,
  });

  const executionUsage = {
    tokensUsed: compiled.log.tokenSize,
    durationMs: artifacts.length * 15,
    costMicros: compiled.log.tokenSize * 2,
  };

  const budgetOutcome = evaluateExecutionBudget(executionBudget, executionUsage);

  const scorecard = scoreTenantDecisionOutcomes({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    tp: 8,
    fp: 2,
    tn: 12,
    fn: 3,
    driftScore: Math.max(0, projection.exceptionFrequencyTrend),
    roiDelta: recorder.projection.supplierReliabilityScore - recorder.projection.supplierCostDrift,
  });
  const scoringAlert = evaluateScoringThresholds(scorecard, {
    minPrecision: 0.7,
    minRecall: 0.65,
    maxFalsePositiveRate: 0.25,
    maxFalseNegativeRate: 0.35,
    maxDriftScore: 0.3,
  });

  const effectiveAiAction = budgetOutcome.circuitBroken
    ? budgetOutcome.fallbackAction
    : recorder.aiAction;

  const compare = compareDualPathOutputs({
    deterministicScore: Math.max(0, 1 - projection.supplierCostDrift),
    aiScore: effectiveAiAction === "RULE_ONLY_FALLBACK" ? 0.4 : 0.8,
    tolerance: 0.15,
  });

  const schemaGateBase = evaluateSchemaLockedAIResponse({
    response: {
      action: effectiveAiAction,
      confidence: recorder.deterministicAction === effectiveAiAction ? 0.8 : 0.45,
      rationaleCode: "runtime-heartbeat",
    },
    deterministicFallbackAction: "RULE_ONLY_FALLBACK",
  });

  const schemaGate = budgetOutcome.circuitBroken
    ? {
        valid: false,
        fallbackDeterministicAction: budgetOutcome.fallbackAction,
        errors: [...schemaGateBase.errors, ...budgetOutcome.reasonCodes],
      }
    : schemaGateBase;

  const heartbeat = runTimerHeartbeat({
    tenantId: input.tenantId,
    heartbeatId,
    driftScore: scorecard.driftScore,
    riskExposureScore: Math.max(0, 1 - projection.bankReconciliationStabilityScore),
    exceptionBacklog: Math.round(Math.max(0, projection.exceptionFrequencyTrend) * 100),
    policyHealthScore: scorecard.precision,
    envelopeVerified: schemaGate.valid,
  });

  const adaptation = runAdaptationScheduler({
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    tier: input.tier,
    driftScore: Math.max(scorecard.driftScore, compare.delta),
    tolerance: 0.2,
    moderateMultiplier: 1.75,
  });

  const currentModeDoc = await readReadmodelItem(db, input.tenantId, "autopilotMode", "active");
  const currentMode = typeof currentModeDoc?.["mode"] === "string"
    ? (currentModeDoc["mode"] as "Observe" | "Advise" | "Constrained-Act" | "Hold" | "Lockdown")
    : "Observe";

  const modeTarget = adaptation.gate === "hold"
    ? "Hold"
    : adaptation.gate === "propose"
      ? "Advise"
      : "Observe";

  const modeTransition = transitionAutopilotMode({
    currentMode,
    targetMode: modeTarget,
    scoringStability: scorecard.precision,
    scoringStabilityThreshold: 0.75,
    reason: `adaptation:${adaptation.gate}`,
    triggerCondition: heartbeat.reasons.join("|") || "nominal",
  });

  const envelope = evaluateProtectionEnvelope(
    {
      financialExposureCapCents: 250000,
      minConfidence: 0.6,
      maxRiskScore: 0.7,
      maxBlastRadius: 2,
      scopeRestriction: "month-level",
    },
    {
      requestedExposureCents: Math.max(0, Math.round(Math.abs(recorder.projection.supplierCostDrift) * 100000)),
      confidenceScore: recorder.projection.supplierReliabilityScore,
      riskScore: Math.max(0, 1 - recorder.projection.bankReconciliationStabilityScore),
      requestedBlastRadius: compare.classification === "human_review" ? 2 : 1,
      requestedScope: "month-level",
      currentMode: modeTransition.accepted ? modeTransition.nextMode : currentMode,
    }
  );

  const arbiter = arbitrateCommand({
    deterministicAction: recorder.deterministicAction,
    aiRecommendedAction: effectiveAiAction,
    hardPolicyAllowedActions: envelope.allowed ? [recorder.deterministicAction, effectiveAiAction] : ["DENY"],
  });

  const shadowRiskScore = Math.max(0, 1 - recorder.projection.bankReconciliationStabilityScore);
  const shadowCandidateAllowed =
    recorder.projection.supplierReliabilityScore >= shadowMinConfidence &&
    shadowRiskScore <= shadowMaxRiskScore;

  const shadowDecision = evaluatePolicyShadowDecision({
    enabled: policyShadowEnabled,
    enforcedAllowed: envelope.allowed,
    candidateAllowed: shadowCandidateAllowed,
  });
  const nextShadowOutcomes = [...previousShadowOutcomes, shadowDecision].slice(-500);
  const shadowSummary = summarizePolicyShadow(nextShadowOutcomes);

  const effectiveMode = envelope.allowed
    ? (modeTransition.accepted ? modeTransition.nextMode : currentMode)
    : envelope.downgradedMode;

  if (!schemaGate.valid || budgetOutcome.circuitBroken) {
    const quarantineEnvelope = createQuarantineEnvelope({
      quarantineId: `${heartbeatId}:quarantine`,
      tenantId: input.tenantId,
      sourceType: "zerebrox.heartbeat",
      reasonCode: budgetOutcome.circuitBroken ? "BUDGET_CIRCUIT_BREAK" : "SCHEMA_GATE_INVALID",
      payload: {
        tenantId: input.tenantId,
        heartbeatId,
        budgetReasonCodes: budgetOutcome.reasonCodes,
        schemaErrors: schemaGate.errors,
        monthKey: input.monthKey,
      },
      createdAtIso: nowIso,
    });

    await writeReadmodelDoc(db, input.tenantId, "zerebroxQuarantine", quarantineEnvelope.quarantineId, {
      ...quarantineEnvelope,
      schemaVersion: 1,
    });

    await createEvent(db, { actorId: input.actorId, now: input.now }, {
      id: `${heartbeatId}:quarantine`,
      tenantId: input.tenantId,
      type: "zerebrox.quarantine",
      occurredAt: nowIso,
      recordedAt: nowIso,
      monthKey: input.monthKey,
      deterministicId: quarantineEnvelope.quarantineId,
      payload: {
        reason_code: quarantineEnvelope.reasonCode,
        status: quarantineEnvelope.status,
      },
    });
  }

  await mergeReadmodelDoc(db, input.tenantId, "autopilotMode", "active", {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    mode: effectiveMode,
    reason: modeTransition.reason,
    triggerCondition: modeTransition.triggerCondition,
    updatedAt: nowIso,
    schemaVersion: 1,
  });

  if (adaptation.recommendedAction === "propose_policy_delta") {
    const proposal = buildPolicyDeltaProposal({
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      pendingPolicyVersion: `${policyVersion}.next`,
      detectedPattern: scoringAlert.breached ? "threshold_breach" : "soft_drift",
      estimatedRoiDelta: scorecard.estimatedRoiDelta,
      estimatedRiskDelta: scorecard.falsePositiveRate,
      scorecard,
    });
    await writeReadmodelDoc(db, input.tenantId, "policyProposals", proposal.proposalId, {
      ...proposal,
      createdAt: nowIso,
      createdBy: input.actorId,
      approvalStatus: "PENDING_APPROVAL",
      schemaVersion: 1,
    });
  }

  const feedback = normalizeFeedbackEvent({
    eventId: `${heartbeatId}:feedback`,
    tenantId: input.tenantId,
    source: adaptation.gate === "hold" ? "exception_resolution" : "bank_reconciliation",
    actorType: "system",
    actorId: input.actorId,
    occurredAtIso: nowIso,
    monthKey: input.monthKey,
    decisionId: recorder.decisionId,
    payload: {
      adaptationGate: adaptation.gate,
      escalated: heartbeat.escalateToAdaptationScheduler,
    },
  });

  const truthLink = bindDecisionToTruth({
    decision: {
      decisionId: recorder.decisionId,
      tenantId: input.tenantId,
      monthKey: input.monthKey,
      policyVersion,
      contextHash: recorder.contextHash,
      confidenceScore: recorder.projection.supplierReliabilityScore,
      financialImpactEstimate: recorder.projection.supplierCostDrift * 100000,
      createdAtIso: nowIso,
    },
    truth: {
      truthEventId: `${heartbeatId}:truth`,
      decisionId: recorder.decisionId,
      tenantId: input.tenantId,
      status: adaptation.gate === "hold" ? "overridden" : "confirmed_correct",
      observedAtIso: nowIso,
      actorId: input.actorId,
    },
    linkId: `${heartbeatId}:link`,
    linkedAtIso: nowIso,
  });

  await createEvent(db, { actorId: input.actorId, now: input.now }, {
    id: `${heartbeatId}:decision`,
    tenantId: input.tenantId,
    type: "zerebrox.decision",
    occurredAt: nowIso,
    recordedAt: nowIso,
    monthKey: input.monthKey,
    deterministicId: recorder.decisionId,
    payload: {
      decision_id: recorder.decisionId,
      policy_version: policyVersion,
      context_hash: recorder.contextHash,
      confidence_score: recorder.projection.supplierReliabilityScore,
      financial_impact_estimate: recorder.projection.supplierCostDrift,
      deterministic_action: recorder.deterministicAction,
      ai_action: effectiveAiAction,
      final_action: arbiter.finalAction,
      effective_mode: effectiveMode,
      budget_circuit_broken: budgetOutcome.circuitBroken,
      policy_shadow: shadowDecision.classification,
    },
  });

  await createEvent(db, { actorId: input.actorId, now: input.now }, {
    id: `${heartbeatId}:truth`,
    tenantId: input.tenantId,
    type: "zerebrox.truth_link",
    occurredAt: nowIso,
    recordedAt: nowIso,
    monthKey: input.monthKey,
    deterministicId: truthLink.linkId,
    payload: {
      decision_id: truthLink.decisionId,
      truth_event_id: truthLink.truthEventId,
      status: truthLink.status,
      linked_at: truthLink.linkedAtIso,
    },
  });

  await createEvent(db, { actorId: input.actorId, now: input.now }, {
    id: `${heartbeatId}:feedback`,
    tenantId: input.tenantId,
    type: "zerebrox.feedback",
    occurredAt: feedback.occurredAtIso,
    recordedAt: nowIso,
    monthKey: input.monthKey,
    deterministicId: feedback.eventId,
    payload: feedback.payload,
  });

  const nextTimeline = [...previousTimeline, recorder].slice(-100);
  await writeReadmodel(db, input.tenantId, "flightRecorder", input.monthKey, {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    activePolicyVersion: policyVersion,
    contextLog: compiled.log,
    heartbeat,
    adaptation,
    scoringAlert,
    envelope,
    arbiter,
    modeTransition,
    effectiveMode,
    dualPathComparison: compare,
    executionBudget,
    executionUsage,
    budgetOutcome,
    policyShadow: {
      enabled: policyShadowEnabled,
      decision: shadowDecision,
      summary: shadowSummary,
    },
    timeline: nextTimeline,
    generatedAt: nowIso,
    schemaVersion: 1,
  });

  await writeReadmodelDoc(db, input.tenantId, "policyShadowRuns", heartbeatId, {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    heartbeatId,
    policyVersion,
    decision: shadowDecision,
    createdAt: nowIso,
    schemaVersion: 1,
  });

  await writeReadmodel(db, input.tenantId, "policyShadow", "summary", {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    outcomes: nextShadowOutcomes,
    summary: shadowSummary,
    generatedAt: nowIso,
    schemaVersion: 1,
  });

  await mergeReadmodelDoc(db, input.tenantId, "controlPlaneRuns", `${input.monthKey}:${input.tier}`, {
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    tier: input.tier,
    heartbeatId,
    escalated: heartbeat.escalateToAdaptationScheduler,
    adaptationGate: adaptation.gate,
    updatedAt: nowIso,
    schemaVersion: 1,
  });

  return {
    success: true,
    tenantId: input.tenantId,
    monthKey: input.monthKey,
    heartbeatId,
    escalated: heartbeat.escalateToAdaptationScheduler,
    adaptationGate: adaptation.gate,
    budgetCircuitBroken: budgetOutcome.circuitBroken,
    shadowDisagreement: shadowDecision.disagreement,
    recorderPath: `tenants/${input.tenantId}/readmodels/flightRecorder/${input.monthKey}/snapshot`,
  };
}

export async function replayZerebroxDeadLetterWorkflow(
  db: Firestore,
  input: ZerebroxDeadLetterReplayInput,
): Promise<ZerebroxDeadLetterReplayOutcome> {
  const nowIso = input.now.toDate().toISOString();
  const quarantineDoc = await readReadmodelItem(db, input.tenantId, "zerebroxQuarantine", input.quarantineId);
  if (!quarantineDoc) {
    throw new Error("quarantine envelope not found");
  }

  const envelope = {
    quarantineId: input.quarantineId,
    tenantId: input.tenantId,
    sourceType: typeof quarantineDoc["sourceType"] === "string" ? (quarantineDoc["sourceType"] as string) : "zerebrox.heartbeat",
    reasonCode: typeof quarantineDoc["reasonCode"] === "string" ? (quarantineDoc["reasonCode"] as string) : "UNKNOWN",
    payloadHash: typeof quarantineDoc["payloadHash"] === "string" ? (quarantineDoc["payloadHash"] as string) : "",
    payload: typeof quarantineDoc["payload"] === "object" && quarantineDoc["payload"] !== null
      ? (quarantineDoc["payload"] as Record<string, unknown>)
      : {},
    createdAtIso: typeof quarantineDoc["createdAtIso"] === "string" ? (quarantineDoc["createdAtIso"] as string) : nowIso,
    replayAttempts: typeof quarantineDoc["replayAttempts"] === "number" ? (quarantineDoc["replayAttempts"] as number) : 0,
    status: (typeof quarantineDoc["status"] === "string"
      ? quarantineDoc["status"]
      : "QUARANTINED") as "QUARANTINED" | "REPLAYED" | "FAILED",
  };

  const replay = replayQuarantinedEnvelope({
    envelope,
    maxReplayAttempts: input.maxReplayAttempts ?? 3,
    validator: (payload) => payload["tenantId"] === input.tenantId,
  });

  await mergeReadmodelDoc(db, input.tenantId, "zerebroxQuarantine", input.quarantineId, {
    status: replay.status,
    replayAttempts: replay.replayAttempts,
    replayReasonCode: replay.reasonCode,
    lastReplayAt: nowIso,
    updatedBy: input.actorId,
    schemaVersion: 1,
  });

  await createEvent(db, { actorId: input.actorId, now: input.now }, {
    id: `${input.quarantineId}:replay:${input.now.toMillis()}`,
    tenantId: input.tenantId,
    type: "zerebrox.dead_letter_replay",
    occurredAt: nowIso,
    recordedAt: nowIso,
    monthKey: typeof envelope.payload["monthKey"] === "string" ? (envelope.payload["monthKey"] as string) : "unknown",
    deterministicId: input.quarantineId,
    payload: {
      status: replay.status,
      reason_code: replay.reasonCode,
      replay_attempts: replay.replayAttempts,
    },
  });

  return {
    tenantId: input.tenantId,
    quarantineId: input.quarantineId,
    status: replay.status,
    replayAttempts: replay.replayAttempts,
    reasonCode: replay.reasonCode,
  };
}

export async function approveZerebroxPolicyProposalWorkflow(
  db: Firestore,
  input: ZerebroxPolicyApprovalInput,
): Promise<{ readonly activatedVersion: string; readonly rolledBack: boolean }> {
  const proposal = await readReadmodelItem(db, input.tenantId, "policyProposals", input.proposalId);
  if (!proposal) {
    throw new Error("policy proposal not found");
  }

  const canary = evaluateCanaryShadow({
    candidatePolicyVersion: input.candidatePolicyVersion,
    baselinePolicyVersion: input.baselinePolicyVersion,
    regressionPrecisionDelta: input.regressionPrecisionDelta,
    regressionRecallDelta: input.regressionRecallDelta,
    maxAllowedPrecisionDrop: 0.03,
    maxAllowedRecallDrop: 0.03,
  });

  if (canary.autoRollback) {
    await mergeReadmodelDoc(db, input.tenantId, "policyProposals", input.proposalId, {
      approvalStatus: "REJECTED_BY_CANARY",
      updatedAt: input.now.toDate().toISOString(),
      canary,
      schemaVersion: 1,
    });
    return {
      activatedVersion: input.baselinePolicyVersion,
      rolledBack: true,
    };
  }

  const activation = activatePolicyVersion({
    activeVersion: {
      version: input.baselinePolicyVersion,
      activatedAtIso: input.now.toDate().toISOString(),
      activatedBy: input.actorId,
      archived: false,
    },
    nextVersion: input.candidatePolicyVersion,
    actorId: input.actorId,
    activatedAtIso: input.now.toDate().toISOString(),
  });

  await writeReadmodelDoc(db, input.tenantId, "policyVersions", "active", {
    tenantId: input.tenantId,
    activeVersion: activation.activated.version,
    archivedVersion: activation.archived.version,
    activationDelta: activation.outcome.activationDelta,
    activatedBy: input.actorId,
    activatedAt: input.now.toDate().toISOString(),
    schemaVersion: 1,
  });

  await mergeReadmodelDoc(db, input.tenantId, "policyProposals", input.proposalId, {
    approvalStatus: "APPROVED",
    activatedVersion: activation.activated.version,
    updatedAt: input.now.toDate().toISOString(),
    canary,
    schemaVersion: 1,
  });

  return {
    activatedVersion: activation.activated.version,
    rolledBack: false,
  };
}
