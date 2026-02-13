import {
  AppendOnlyDecisionFeedbackLog,
  arbitrateCommand,
  bindDecisionToTruth,
  buildFlightRecorderEntry,
  buildPolicyDeltaProposal,
  compareDualPathOutputs,
  computeCoreMemoryProjection,
  evaluateCanaryShadow,
  evaluateProtectionEnvelope,
  evaluateSchemaLockedAIResponse,
  normalizeFeedbackEvent,
  runAdaptationScheduler,
  runTimerHeartbeat,
  scoreTenantDecisionOutcomes,
  transitionAutopilotMode,
  type DecisionRecord,
} from "../../../server/logic/brain";

function baseDecision(): DecisionRecord {
  return {
    decisionId: "dec-001",
    tenantId: "tenant-a",
    monthKey: "2026-02",
    policyVersion: "pv-9",
    contextHash: "ctx-a",
    confidenceScore: 0.91,
    financialImpactEstimate: 1200,
    createdAtIso: "2026-02-14T10:00:00Z",
  };
}

describe("ZEREBROX invariants", () => {
  it("keeps decision->truth->feedback chain deterministic and append-only", () => {
    const log = new AppendOnlyDecisionFeedbackLog();
    const decision = baseDecision();
    log.appendDecision(decision);

    const truthLink = bindDecisionToTruth({
      decision,
      truth: {
        truthEventId: "truth-001",
        decisionId: decision.decisionId,
        tenantId: decision.tenantId,
        status: "confirmed_correct",
        observedAtIso: "2026-02-14T10:01:00Z",
        actorId: "system",
      },
      linkId: "link-001",
      linkedAtIso: "2026-02-14T10:02:00Z",
    });
    log.appendTruthLink(truthLink);

    const feedback = normalizeFeedbackEvent({
      eventId: "fb-001",
      tenantId: decision.tenantId,
      decisionId: decision.decisionId,
      source: "bank_reconciliation",
      actorType: "system",
      actorId: "system",
      occurredAtIso: "2026-02-14T10:03:00Z",
      monthKey: decision.monthKey,
      payload: { outcome: "settled" },
    });
    log.appendFeedback(feedback);

    expect(log.listDecisions(decision.tenantId)).toHaveLength(1);
    expect(log.listTruthLinks(decision.tenantId)).toHaveLength(1);
    expect(log.listFeedback(decision.tenantId)).toHaveLength(1);
    expect(() => log.appendFeedback(feedback)).toThrow(/already exists/);
  });

  it("enforces schema-locked fallback for malformed ai output", () => {
    const malformed = evaluateSchemaLockedAIResponse({
      response: { confidence: 0.9, rationaleCode: "missing-action" },
      deterministicFallbackAction: "RULE_ONLY_FALLBACK",
    });
    const valid = evaluateSchemaLockedAIResponse({
      response: { action: "HOLD_POLICY", confidence: 0.9, rationaleCode: "ok" },
      deterministicFallbackAction: "RULE_ONLY_FALLBACK",
    });

    expect(malformed.valid).toBe(false);
    expect(malformed.fallbackDeterministicAction).toBe("RULE_ONLY_FALLBACK");
    expect(valid.valid).toBe(true);
  });

  it("applies arbitration and dual-path disagreement tiers", () => {
    const arbiter = arbitrateCommand({
      deterministicAction: "PAYMENT_HOLD",
      aiRecommendedAction: "AUTO_PAY",
      hardPolicyAllowedActions: ["PAYMENT_HOLD"],
    });
    const comparisonMinor = compareDualPathOutputs({
      deterministicScore: 0.7,
      aiScore: 0.73,
      tolerance: 0.05,
    });
    const comparisonEscalated = compareDualPathOutputs({
      deterministicScore: 0.7,
      aiScore: 0.82,
      tolerance: 0.05,
    });

    expect(arbiter.finalAction).toBe("PAYMENT_HOLD");
    expect(arbiter.aiDiscarded).toBe(true);
    expect(comparisonMinor.classification).toBe("minor_variance");
    expect(comparisonEscalated.classification).toBe("human_review");
  });

  it("downgrades mode when protection envelope is breached", () => {
    const denied = evaluateProtectionEnvelope(
      {
        financialExposureCapCents: 10000,
        minConfidence: 0.8,
        maxRiskScore: 0.4,
        maxBlastRadius: 1,
        scopeRestriction: "month-level",
      },
      {
        requestedExposureCents: 20000,
        confidenceScore: 0.7,
        riskScore: 0.6,
        requestedBlastRadius: 2,
        requestedScope: "month-level",
        currentMode: "Constrained-Act",
      }
    );

    expect(denied.allowed).toBe(false);
    expect(denied.downgradedMode).toBe("Hold");
    expect(denied.reasons.length).toBeGreaterThan(0);
  });

  it("keeps autopilot transition legality and stability gates", () => {
    const illegal = transitionAutopilotMode({
      currentMode: "Observe",
      targetMode: "Lockdown",
      scoringStability: 0.9,
      scoringStabilityThreshold: 0.8,
      reason: "manual",
      triggerCondition: "test",
    });
    const unstable = transitionAutopilotMode({
      currentMode: "Observe",
      targetMode: "Constrained-Act",
      scoringStability: 0.6,
      scoringStabilityThreshold: 0.8,
      reason: "upgrade",
      triggerCondition: "test",
    });

    expect(illegal.accepted).toBe(false);
    expect(unstable.accepted).toBe(false);
  });

  it("produces deterministic scoring, heartbeat and adaptation gates", () => {
    const scorecard = scoreTenantDecisionOutcomes({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      tp: 8,
      fp: 2,
      tn: 10,
      fn: 3,
      driftScore: 0.31,
      roiDelta: 0.05,
    });
    const heartbeat = runTimerHeartbeat({
      tenantId: "tenant-a",
      heartbeatId: "hb-001",
      driftScore: scorecard.driftScore,
      riskExposureScore: 0.8,
      exceptionBacklog: 10,
      policyHealthScore: scorecard.precision,
      envelopeVerified: true,
    });
    const adaptation = runAdaptationScheduler({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      tier: "nightly",
      driftScore: 0.3,
      tolerance: 0.2,
      moderateMultiplier: 1.75,
    });

    expect(scorecard.precision).toBe(0.8);
    expect(heartbeat.escalateToAdaptationScheduler).toBe(true);
    expect(adaptation.gate).toBe("propose");
  });

  it("keeps proposal id deterministic and canary rollback bounded", () => {
    const scorecard = scoreTenantDecisionOutcomes({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      tp: 8,
      fp: 2,
      tn: 10,
      fn: 2,
      driftScore: 0.2,
      roiDelta: 0.04,
    });

    const proposalA = buildPolicyDeltaProposal({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      pendingPolicyVersion: "pv-10",
      detectedPattern: "soft_drift",
      estimatedRoiDelta: 0.02,
      estimatedRiskDelta: 0.01,
      scorecard,
    });
    const proposalB = buildPolicyDeltaProposal({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      pendingPolicyVersion: "pv-10",
      detectedPattern: "soft_drift",
      estimatedRoiDelta: 0.02,
      estimatedRiskDelta: 0.01,
      scorecard,
    });
    const canary = evaluateCanaryShadow({
      candidatePolicyVersion: "pv-10",
      baselinePolicyVersion: "pv-9",
      regressionPrecisionDelta: -0.08,
      regressionRecallDelta: -0.01,
      maxAllowedPrecisionDrop: 0.03,
      maxAllowedRecallDrop: 0.03,
    });

    expect(proposalA.proposalId).toBe(proposalB.proposalId);
    expect(canary.autoRollback).toBe(true);
  });

  it("tracks flight-recorder deltas from previous context", () => {
    const projection = computeCoreMemoryProjection({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      supplierCostCurrentCents: 120000,
      supplierCostPreviousCents: 100000,
      supplierFulfilledOrders: 95,
      supplierTotalOrders: 100,
      exceptionsCount: 5,
      previousExceptionsCount: 4,
      paymentLagDays: [1, 2, 2, 3, 8],
      reconciledTransactions: 98,
      totalTransactions: 100,
    });

    const replay = buildFlightRecorderEntry({
      current: {
        decision: baseDecision(),
        projection,
        deterministicAction: "HOLD_POLICY",
        aiAction: "RULE_ONLY_FALLBACK",
        whyFired: "risk threshold",
      },
      previous: {
        contextHash: "ctx-older",
        policyVersion: "pv-8",
        deterministicAction: "AUTO_PAY",
        aiAction: "AUTO_PAY",
      },
    });

    expect(replay.changedFromPrevious).toEqual(
      expect.arrayContaining(["contextHash", "policyVersion", "deterministicAction", "aiAction"])
    );
  });
});
