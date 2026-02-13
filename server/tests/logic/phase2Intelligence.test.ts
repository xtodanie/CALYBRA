import {
  buildPerformanceGraph,
  computeIntelligenceHealthIndex,
  evaluateDecisionOutcome,
  runPatternDetection,
  summarizeDecisionLedger,
  transitionAutonomyState,
} from "../../../server/logic/brain";

describe("Phase 2 intelligence core", () => {
  it("produces deterministic pattern events for identical replay metrics", () => {
    const input = {
      tenantId: "tenant-001",
      timestamp: "2026-02-13T12:00:00Z",
      metrics: {
        "supplier.cost_delta": [0.02, 0.04, 0.09],
        "expense.cluster_score": [0.2, 0.4, 0.9],
        "reconciliation.drift_rate": [0.01, 0.03, 0.15],
        "manual.override_rate": [0.01, 0.02, 0.25],
      },
    } as const;
    const first = runPatternDetection(input);
    const second = runPatternDetection(input);
    expect(second).toEqual(first);
    expect(first.every((event) => event.type === "pattern_detected")).toBe(true);
  });

  it("evaluates decision outcome deterministically", () => {
    const outcome = evaluateDecisionOutcome({
      decisionId: "dec-1",
      baseline: 100,
      current: 110,
      expectedDelta: 0.08,
      seasonalityFactor: 1,
    });
    expect(outcome.actualDelta).toBe(0.1);
    expect(outcome.success).toBe(true);
  });

  it("downgrades autonomy under repeated misfire/risk conditions", () => {
    const next = transitionAutonomyState({
      current: "Advisory",
      accuracyScore: 0.4,
      driftTriggered: true,
      riskExposure: 0.85,
      consecutiveMisfires: 4,
      roiNegative: true,
    });
    expect(next).toBe("Locked");
  });

  it("summarizes decision quality and health index", () => {
    const ledger = summarizeDecisionLedger([
      { decisionType: "supplier", roi: 0.2, success: true, aiSuggested: true, overridden: false },
      { decisionType: "supplier", roi: -0.1, success: false, aiSuggested: true, overridden: true },
    ]);
    expect(ledger.successRate).toBe(0.5);

    const health = computeIntelligenceHealthIndex({
      predictionAccuracy: 0.75,
      roiDelta: 0.2,
      driftRate: 0.1,
      falsePositiveRate: 0.15,
      autonomyStability: 0.8,
    });
    expect(health).toBeGreaterThan(0.6);
  });

  it("builds replay-stable performance graph ordering", () => {
    const graph = buildPerformanceGraph([
      { atIso: "2026-02-15T00:00:00Z", improvementCompounding: 0.2, riskReductionTrend: 0.1, decisionAccuracyTrend: 0.75 },
      { atIso: "2026-02-14T00:00:00Z", improvementCompounding: 0.1, riskReductionTrend: 0.08, decisionAccuracyTrend: 0.7 },
    ]);
    expect(graph[0]?.atIso).toBe("2026-02-14T00:00:00Z");
  });
});
