import {
  assignEscalationDeterministic,
  buildArtifactLineageGraph,
  buildClosureScoreboard,
  buildExplainabilityPack,
  compactArtifactsByWindow,
  computeReplayBenchmark,
  evaluateFreezeCandidate,
  evaluatePerformanceBudget,
  runDeterminismAudit,
  runPolicySimulation,
  tuneThresholdBounded,
  DeterministicPolicyRegistry,
  verifyCompaction,
} from "../../../server/logic/brain";

describe("Phase 2 next 10 (0628-0637)", () => {
  it("builds deterministic lineage graph", () => {
    const graph = buildArtifactLineageGraph([
      { artifactId: "a-root", type: "event_log", generatedAt: "2026-02-13T10:00:00Z" },
      { artifactId: "a-1", parentArtifactId: "a-root", type: "decision", generatedAt: "2026-02-13T10:01:00Z" },
      { artifactId: "a-2", parentArtifactId: "a-1", type: "snapshot", generatedAt: "2026-02-13T10:02:00Z" },
    ]);

    expect(graph.roots).toEqual(["a-root"]);
    expect(graph.nodes["a-2"]?.depth).toBe(2);
  });

  it("runs determinism audit and policy simulation", () => {
    const audit = runDeterminismAudit({
      runLabel: "run-1",
      samples: [
        { runId: "r1", replayHash: "h1", eventsApplied: 10 },
        { runId: "r2", replayHash: "h1", eventsApplied: 10 },
      ],
    });
    expect(audit.passed).toBe(true);

    const registry = new DeterministicPolicyRegistry();
    registry.register({ id: "p1", path: "brain/read-only/a", enabled: true, minConfidence: 0.7 });

    const simulation = runPolicySimulation(registry, [
      { label: "low", path: "brain/read-only/a", confidence: 0.5 },
      { label: "high", path: "brain/read-only/a", confidence: 0.9 },
    ]);

    expect(simulation.find((x) => x.label === "high")?.allowed).toBe(true);
    expect(simulation.find((x) => x.label === "low")?.allowed).toBe(false);
  });

  it("tunes thresholds and balances escalation", () => {
    const tuning = tuneThresholdBounded({
      currentThreshold: 0.7,
      observedSuccessRate: 0.5,
      targetSuccessRate: 0.8,
      maxAdjustmentStep: 0.1,
      minBound: 0.4,
      maxBound: 0.95,
    });
    expect(tuning.nextThreshold).toBeLessThanOrEqual(0.8);

    const assignment = assignEscalationDeterministic({
      escalationId: "esc-1",
      minRole: "controller",
      capacities: [
        { reviewerId: "u1", role: "auditor", availableSlots: 3 },
        { reviewerId: "u2", role: "controller", availableSlots: 2 },
        { reviewerId: "u3", role: "owner", availableSlots: 1 },
      ],
    });

    expect(assignment.assigned).toBe(true);
    expect(assignment.reviewerId).toBe("u2");
  });

  it("verifies compaction and performance budgets", () => {
    const artifacts = [
      { artifactId: "a1", tenantId: "t1", monthKey: "2026-01", type: "decision", generatedAt: "2026-02-13T10:00:00Z", hash: "1".repeat(64) },
      { artifactId: "a2", tenantId: "t1", monthKey: "2026-01", type: "health", generatedAt: "2026-02-13T10:00:01Z", hash: "2".repeat(64) },
      { artifactId: "a3", tenantId: "t1", monthKey: "2026-01", type: "event", generatedAt: "2026-02-13T10:00:02Z", hash: "3".repeat(64) },
      { artifactId: "a4", tenantId: "t1", monthKey: "2026-01", type: "event", generatedAt: "2026-02-13T10:00:03Z", hash: "4".repeat(64) },
    ] as const;

    const compact = compactArtifactsByWindow(artifacts, 2)[0];
    expect(compact).toBeDefined();

    const verify = verifyCompaction(compact!, artifacts.slice(0, 2));
    expect(verify.valid).toBe(true);

    const benchmark = computeReplayBenchmark([
      { runId: "r1", durationMs: 100, eventsApplied: 1000 },
      { runId: "r2", durationMs: 120, eventsApplied: 1000 },
    ]);

    const perf = evaluatePerformanceBudget(benchmark, {
      maxAvgDurationMs: 150,
      maxP95DurationMs: 200,
      minThroughputEventsPerSecond: 5,
    });
    expect(perf.passed).toBe(true);
  });

  it("builds explainability pack and freeze candidate", () => {
    const pack = buildExplainabilityPack({
      tenantId: "t1",
      monthKey: "2026-01",
      escalationId: "esc-1",
      policyPath: "brain/read-only/finalize",
      evidenceRefs: ["ev2", "ev1"],
      replayHash: "abc",
      healthIndex: 0.7,
      generatedAt: "2026-02-13T10:10:00Z",
    });
    expect(pack.packId.startsWith("xpk:")).toBe(true);

    const scoreboard = buildClosureScoreboard({
      determinism: true,
      integrity: true,
      acl: true,
      emulator: true,
      preflight: true,
      perfBudget: true,
    });
    expect(scoreboard.ready).toBe(true);

    const freeze = evaluateFreezeCandidate(scoreboard);
    expect(freeze.approved).toBe(true);
    expect(freeze.recommendation).toBe("freeze");
  });
});
