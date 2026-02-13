import { BrainReplayInput, runBrainReplayWorkflow } from "../../../server/workflows/brainReplay.workflow";

describe("brainReplay.workflow", () => {
  const baseInput: BrainReplayInput = {
    tenantId: "tenant-wf",
    actorId: "svc-brain",
    actorRole: "controller",
    policyPath: "brain/read-only/workflow",
    traceId: "trace-1",
    requestId: "req-1",
    timestamp: "2026-02-13T14:00:00Z",
    routerInput: { analyze: true },
    reflectionIndicators: {
      anomalyRate: 0.2,
      efficiencyDelta: 0.1,
      behaviorShift: 0.1,
    },
    aiResponse: {
      tenantId: "tenant-wf",
      contextHash: "ctx-1",
      model: "gpt-5.3-codex",
      generatedAt: "2026-02-13T14:00:00Z",
      suggestions: [
        {
          suggestionId: "s-1",
          code: "OBSERVE_DRIFT",
          summary: "Observe monthly drift",
          confidence: 0.91,
          evidenceRefs: ["ev-1"],
        },
      ],
      mutationIntent: "none",
      allowedActions: ["suggest", "explain", "escalate"],
    },
  };

  it("produces deterministic event/replay outputs for identical input", () => {
    const first = runBrainReplayWorkflow(baseInput);
    const second = runBrainReplayWorkflow(baseInput);

    expect(first).toEqual(second);
    expect(first.replay.eventsApplied).toBe(2);
    expect(first.events[0]?.parent_id).toBeUndefined();
    expect(first.events[1]?.parent_id).toBe(first.events[0]?.id);
  });

  it("blocks acceptance when AI gate constraints are violated", () => {
    const denied = runBrainReplayWorkflow({
      ...baseInput,
      actorRole: "viewer",
    });

    expect(denied.gate.accepted).toBe(false);
    expect(denied.accepted).toBe(false);
  });

  it("creates snapshot when event interval is satisfied", () => {
    const withSnapshot = runBrainReplayWorkflow({
      ...baseInput,
      snapshotPolicy: {
        interval: 2,
        maxRetained: 10,
      },
    });

    expect(withSnapshot.snapshot).toBeDefined();
    expect(withSnapshot.contextWindow.snapshotId).toBe(withSnapshot.snapshot?.snapshotId);
  });

  it("reuses prior chain and keeps replay deterministic with retained snapshots", () => {
    const first = runBrainReplayWorkflow({
      ...baseInput,
      snapshotPolicy: { interval: 2, maxRetained: 10 },
    });

    const second = runBrainReplayWorkflow({
      ...baseInput,
      requestId: "req-2",
      traceId: "trace-2",
      priorEvents: first.events,
      priorSnapshots: first.snapshots,
      snapshotPolicy: { interval: 2, maxRetained: 10 },
    });

    expect(second.events.length).toBeGreaterThan(first.events.length);
    const priorTailId = first.events[first.events.length - 1]?.id;
    const secondRouterEvent = second.events.find((event) => event.id === "router:req-2");
    expect(secondRouterEvent?.parent_id).toBe(priorTailId);
    expect(second.snapshots.length).toBeGreaterThanOrEqual(1);
    expect(second.replay.replayHash).toBe(runBrainReplayWorkflow({
      ...baseInput,
      requestId: "req-2",
      traceId: "trace-2",
      priorEvents: first.events,
      priorSnapshots: first.snapshots,
      snapshotPolicy: { interval: 2, maxRetained: 10 },
    }).replay.replayHash);
  });
});
