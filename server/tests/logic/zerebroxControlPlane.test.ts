import {
  AppendOnlyDecisionFeedbackLog,
  arbitrateCommand,
  bindDecisionToTruth,
  buildFlightRecorderEntry,
  compareDualPathOutputs,
  compileRuntimeContext,
  computeCoreMemoryProjection,
  evaluateCanaryShadow,
  evaluateProtectionEnvelope,
  evaluateSchemaLockedAIResponse,
  evaluateScoringThresholds,
  normalizeFeedbackEvent,
  runAdaptationScheduler,
  runTimerHeartbeat,
  scoreTenantDecisionOutcomes,
  transitionAutopilotMode,
} from "../../../server/logic/brain";

describe("ZEREBROX control plane", () => {
  it("enforces append-only decision + truth + feedback linkage", () => {
    const log = new AppendOnlyDecisionFeedbackLog();
    const decision = {
      decisionId: "dec-1",
      tenantId: "tenant-a",
      monthKey: "2026-02",
      policyVersion: "pv-1",
      contextHash: "ctx-1",
      confidenceScore: 0.91,
      financialImpactEstimate: 1200,
      createdAtIso: "2026-02-13T10:00:00Z",
    } as const;
    log.appendDecision(decision);

    const link = bindDecisionToTruth({
      decision,
      truth: {
        truthEventId: "truth-1",
        decisionId: "dec-1",
        tenantId: "tenant-a",
        status: "confirmed_correct",
        observedAtIso: "2026-02-13T11:00:00Z",
        actorId: "system",
      },
      linkId: "link-1",
      linkedAtIso: "2026-02-13T11:01:00Z",
    });
    log.appendTruthLink(link);

    const feedback = normalizeFeedbackEvent({
      eventId: "fb-1",
      tenantId: "tenant-a",
      source: "bank_reconciliation",
      actorType: "system",
      actorId: "reco-job",
      occurredAtIso: "2026-02-13T12:00:00Z",
      monthKey: "2026-02",
      decisionId: "dec-1",
      payload: { settled: true },
    });
    log.appendFeedback(feedback);

    expect(log.listDecisions("tenant-a")).toHaveLength(1);
    expect(log.listTruthLinks("tenant-a")[0]?.status).toBe("confirmed_correct");
    expect(log.listFeedback("tenant-a")[0]?.source).toBe("bank_reconciliation");
    expect(() => log.appendDecision(decision)).toThrow(/decision already exists/);
  });

  it("scores tenant outcomes and raises threshold alerts", () => {
    const scorecard = scoreTenantDecisionOutcomes({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      tp: 9,
      fp: 3,
      tn: 15,
      fn: 4,
      driftScore: 0.31,
      roiDelta: 0.07,
    });
    const alert = evaluateScoringThresholds(scorecard, {
      minPrecision: 0.8,
      minRecall: 0.8,
      maxFalsePositiveRate: 0.1,
      maxFalseNegativeRate: 0.2,
      maxDriftScore: 0.25,
    });

    expect(scorecard.precision).toBe(0.75);
    expect(alert.breached).toBe(true);
    expect(alert.reasons.length).toBeGreaterThan(0);
  });

  it("computes deterministic monthly projection", () => {
    const projection = computeCoreMemoryProjection({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      supplierCostCurrentCents: 130000,
      supplierCostPreviousCents: 100000,
      supplierFulfilledOrders: 90,
      supplierTotalOrders: 100,
      exceptionsCount: 12,
      previousExceptionsCount: 10,
      paymentLagDays: [2, 4, 6, 8, 12],
      reconciledTransactions: 95,
      totalTransactions: 100,
    });

    expect(projection.supplierCostDrift).toBe(0.3);
    expect(projection.paymentLagDistribution.p90).toBe(12);
    expect(projection.bankReconciliationStabilityScore).toBe(0.95);
  });

  it("compiles runtime context with least-privilege guardrails", () => {
    const projection = computeCoreMemoryProjection({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      supplierCostCurrentCents: 100000,
      supplierCostPreviousCents: 100000,
      supplierFulfilledOrders: 100,
      supplierTotalOrders: 100,
      exceptionsCount: 10,
      previousExceptionsCount: 10,
      paymentLagDays: [1, 2, 3],
      reconciledTransactions: 100,
      totalTransactions: 100,
    });
    const compiled = compileRuntimeContext({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      projection,
      supplierReliabilityFlags: ["supplier:s-1:stable"],
      activePolicyVersion: "pv-4",
      financialRiskEnvelope: { maxExposureCents: 200000, maxRiskScore: 0.6 },
      dataOriginIds: ["projection:2026-02"],
      tokenBudget: 20,
    });

    expect(compiled.context.activePolicyVersion).toBe("pv-4");
    expect(compiled.log.dataOriginIds).toEqual(["projection:2026-02"]);
    expect(compiled.log.truncated).toBe(true);
  });

  it("runs heartbeat + adaptation gates and blocks risky mode transitions", () => {
    const heartbeat = runTimerHeartbeat({
      tenantId: "tenant-a",
      heartbeatId: "hb-1",
      driftScore: 0.4,
      riskExposureScore: 0.8,
      exceptionBacklog: 3,
      policyHealthScore: 0.9,
      envelopeVerified: true,
    });
    const adaptation = runAdaptationScheduler({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      tier: "nightly",
      driftScore: 0.4,
      tolerance: 0.2,
      moderateMultiplier: 1.75,
    });
    const mode = transitionAutopilotMode({
      currentMode: "Observe",
      targetMode: "Constrained-Act",
      scoringStability: 0.6,
      scoringStabilityThreshold: 0.8,
      reason: "upgrade",
      triggerCondition: "manual-request",
    });

    expect(heartbeat.escalateToAdaptationScheduler).toBe(true);
    expect(adaptation.gate).toBe("hold");
    expect(mode.accepted).toBe(false);
  });

  it("arbitrates rule/ai conflict and handles disagreement tiers", () => {
    const arbiter = arbitrateCommand({
      deterministicAction: "PAYMENT_HOLD",
      aiRecommendedAction: "AUTO_PAY",
      hardPolicyAllowedActions: ["PAYMENT_HOLD"],
    });
    const compareMinor = compareDualPathOutputs({
      deterministicScore: 0.6,
      aiScore: 0.62,
      tolerance: 0.05,
    });
    const compareEscalated = compareDualPathOutputs({
      deterministicScore: 0.6,
      aiScore: 0.8,
      tolerance: 0.05,
    });

    expect(arbiter.finalAction).toBe("PAYMENT_HOLD");
    expect(arbiter.aiDiscarded).toBe(true);
    expect(compareMinor.classification).toBe("minor_variance");
    expect(compareEscalated.classification).toBe("human_review");
  });

  it("enforces envelope denial, schema fallback, replay trace, and canary rollback", () => {
    const envelope = evaluateProtectionEnvelope(
      {
        financialExposureCapCents: 10000,
        minConfidence: 0.8,
        maxRiskScore: 0.4,
        maxBlastRadius: 2,
        scopeRestriction: "supplier-level",
      },
      {
        requestedExposureCents: 20000,
        confidenceScore: 0.7,
        riskScore: 0.6,
        requestedBlastRadius: 4,
        requestedScope: "month-level",
        currentMode: "Constrained-Act",
      }
    );

    const schema = evaluateSchemaLockedAIResponse({
      response: { confidence: 0.95 },
      deterministicFallbackAction: "RULE_ONLY_FALLBACK",
    });

    const projection = computeCoreMemoryProjection({
      tenantId: "tenant-a",
      monthKey: "2026-02",
      supplierCostCurrentCents: 100000,
      supplierCostPreviousCents: 90000,
      supplierFulfilledOrders: 98,
      supplierTotalOrders: 100,
      exceptionsCount: 4,
      previousExceptionsCount: 5,
      paymentLagDays: [1, 2, 3, 5],
      reconciledTransactions: 99,
      totalTransactions: 100,
    });
    const replay = buildFlightRecorderEntry({
      current: {
        decision: {
          decisionId: "dec-9",
          tenantId: "tenant-a",
          monthKey: "2026-02",
          policyVersion: "pv-9",
          contextHash: "ctx-9",
          confidenceScore: 0.9,
          financialImpactEstimate: 200,
          createdAtIso: "2026-02-13T09:00:00Z",
        },
        projection,
        deterministicAction: "PAYMENT_HOLD",
        aiAction: "PAYMENT_HOLD",
        whyFired: "risk above tolerance",
      },
      previous: {
        contextHash: "ctx-8",
        policyVersion: "pv-8",
        deterministicAction: "AUTO_PAY",
        aiAction: "AUTO_PAY",
      },
    });

    const canary = evaluateCanaryShadow({
      candidatePolicyVersion: "pv-10",
      baselinePolicyVersion: "pv-9",
      regressionPrecisionDelta: -0.05,
      regressionRecallDelta: -0.01,
      maxAllowedPrecisionDrop: 0.02,
      maxAllowedRecallDrop: 0.02,
    });

    expect(envelope.allowed).toBe(false);
    expect(envelope.downgradedMode).toBe("Hold");
    expect(schema.valid).toBe(false);
    expect(schema.fallbackDeterministicAction).toBe("RULE_ONLY_FALLBACK");
    expect(replay.changedFromPrevious).toContain("policyVersion");
    expect(canary.autoRollback).toBe(true);
  });
});
