import {
  analyzeReplayDiff,
  buildPreflightReport,
  compactArtifactsByWindow,
  computeReplayBenchmark,
  DeterministicPolicyRegistry,
  evaluateAutonomyCircuitBreaker,
  evaluatePhase2Closure,
  planEscalationSla,
  runUnifiedBrainEngine,
  scoreDecisionQualityV2,
} from "../../../server/logic/brain";

describe("Phase 2 next 10 steps core", () => {
  it("runs unified brain engine deterministically", () => {
    const input = {
      currentAutonomy: "Advisory" as const,
      accuracyScore: 0.82,
      driftTriggered: false,
      riskExposure: 0.25,
      consecutiveMisfires: 0,
      roiNegative: false,
      financialDeviationPct: 0.05,
      reconciliationInstability: 0.2,
      patternConflict: false,
      confidence: 0.84,
      predictionAccuracy: 0.8,
      roiDelta: 0.2,
      driftRate: 0.1,
      falsePositiveRate: 0.1,
      autonomyStability: 0.9,
    };

    const first = runUnifiedBrainEngine(input);
    const second = runUnifiedBrainEngine(input);

    expect(second).toEqual(first);
    expect(first.healthIndex).toBeGreaterThan(0.7);
  });

  it("compacts artifacts and detects replay diffs", () => {
    const artifacts = [
      { artifactId: "a1", tenantId: "t1", monthKey: "2026-01", type: "decision", generatedAt: "2026-02-13T10:00:00.000Z", hash: "1".repeat(64) },
      { artifactId: "a2", tenantId: "t1", monthKey: "2026-01", type: "health", generatedAt: "2026-02-13T10:00:01.000Z", hash: "2".repeat(64) },
      { artifactId: "a3", tenantId: "t1", monthKey: "2026-01", type: "event_log", generatedAt: "2026-02-13T10:00:02.000Z", hash: "3".repeat(64) },
      { artifactId: "a4", tenantId: "t1", monthKey: "2026-01", type: "snapshot", generatedAt: "2026-02-13T10:00:03.000Z", hash: "4".repeat(64) },
    ] as const;

    const compactions = compactArtifactsByWindow(artifacts, 2);
    expect(compactions.length).toBe(2);

    const stable = analyzeReplayDiff([
      { runId: "r1", replayHash: "h1", eventsApplied: 20 },
      { runId: "r2", replayHash: "h1", eventsApplied: 20 },
    ]);
    expect(stable.stable).toBe(true);

    const divergent = analyzeReplayDiff([
      { runId: "r1", replayHash: "h1", eventsApplied: 20 },
      { runId: "r2", replayHash: "h2", eventsApplied: 20 },
    ]);
    expect(divergent.stable).toBe(false);
    expect(divergent.divergentRuns).toContain("r2");
  });

  it("evaluates policy registry, breaker, sla and decision scorer", () => {
    const registry = new DeterministicPolicyRegistry();
    registry.register({ id: "p1", path: "brain/read-only/finalize", enabled: true, minConfidence: 0.7 });

    expect(registry.evaluate("brain/read-only/finalize", 0.75).allowed).toBe(true);
    expect(registry.evaluate("brain/read-only/finalize", 0.2).allowed).toBe(false);

    const breaker = evaluateAutonomyCircuitBreaker({
      autonomy: "Advisory",
      healthIndex: 0.31,
      riskExposure: 0.85,
      escalationCritical: true,
    });
    expect(breaker.tripped).toBe(true);
    expect(breaker.forcedAutonomy).toBe("Locked");

    const sla = planEscalationSla("critical");
    expect(sla.maxResponseMinutes).toBe(15);

    const score = scoreDecisionQualityV2({
      roi: 0.3,
      confidence: 0.9,
      riskPenalty: 0.1,
      overridePenalty: 0,
      driftPenalty: 0.05,
    });
    expect(score.score).toBeGreaterThan(0.55);
    expect(score.grade).toBe("C");
  });

  it("computes benchmark, preflight summary and closure evaluator", () => {
    const benchmark = computeReplayBenchmark([
      { runId: "r1", durationMs: 120, eventsApplied: 1000 },
      { runId: "r2", durationMs: 140, eventsApplied: 1000 },
      { runId: "r3", durationMs: 100, eventsApplied: 1000 },
    ]);
    expect(benchmark.avgDurationMs).toBeGreaterThan(0);
    expect(benchmark.throughputEventsPerSecond).toBeGreaterThan(0);

    const preflight = buildPreflightReport([
      { name: "typecheck", passed: true, details: "ok" },
      { name: "lint", passed: true, details: "ok" },
      { name: "tests", passed: false, details: "failure" },
    ]);
    expect(preflight.passed).toBe(false);
    expect(preflight.failedChecks).toContain("tests");

    const closure = evaluatePhase2Closure({
      determinismPass: true,
      integrityPass: true,
      aclPass: true,
      replayStabilityPass: true,
      emulatorE2ePass: true,
      preflightPass: true,
      unresolvedCriticalDefects: 0,
    });
    expect(closure.closed).toBe(true);
  });
});
