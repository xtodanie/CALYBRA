import {
  buildDeterministicContextWindow,
  buildReflectionEvent,
  createSnapshot,
  InMemoryAppendOnlyEventStore,
  loadLatestSnapshot,
  replayDeterministic,
  routeDeterministic,
  shouldCreateSnapshot,
  stableSha256Hex,
  toEventHashMaterial,
} from "../../../server/logic/brain";

describe("Phase 1 brain core", () => {
  it("enforces append-only hash-chain and deterministic replay", () => {
    const eventOneMaterial = {
      id: "evt-1",
      type: "brain.router",
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "tr-1", policyPath: "brain/read-only", readOnly: true } as const,
      payload: { accepted: true },
      timestamp: "2026-02-13T10:00:00Z",
      parent_id: undefined,
    };
    const eventOne = { ...eventOneMaterial, hash: stableSha256Hex(toEventHashMaterial(eventOneMaterial)) };

    const eventTwoMaterial = {
      id: "evt-2",
      type: "brain.reflection",
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "tr-1", policyPath: "brain/read-only", readOnly: true } as const,
      payload: { severity: "low" },
      timestamp: "2026-02-13T10:01:00Z",
      parent_id: "evt-1",
    };
    const eventTwo = { ...eventTwoMaterial, hash: stableSha256Hex(toEventHashMaterial(eventTwoMaterial)) };

    const store = new InMemoryAppendOnlyEventStore();
    store.append(eventOne);
    store.append(eventTwo);

    const replayOne = replayDeterministic({
      events: store.readAll(),
      initialState: { count: 0 },
      reducer: (state) => ({ count: state.count + 1 }),
    });

    const replayTwo = replayDeterministic({
      events: store.readAll(),
      initialState: { count: 0 },
      reducer: (state) => ({ count: state.count + 1 }),
    });

    expect(replayOne.validation.valid).toBe(true);
    expect(replayOne.replayHash).toBe(replayTwo.replayHash);
    expect(replayOne.state.count).toBe(2);
  });

  it("builds deterministic snapshots and context window", () => {
    const reflection = buildReflectionEvent({
      tenantId: "tenant-a",
      traceId: "trace-ctx",
      actorId: "svc",
      policyPath: "brain/read-only",
      timestamp: "2026-02-13T11:00:00Z",
      indicators: { anomalyRate: 0.2, efficiencyDelta: 0.1, behaviorShift: 0.15 },
    });

    expect(shouldCreateSnapshot({ eventCount: 100, policy: { interval: 100, maxRetained: 50 } })).toBe(true);

    const snapshot = createSnapshot({
      tenantId: "tenant-a",
      event: reflection,
      eventIndex: 99,
      state: { total: 10 },
    });

    const loaded = loadLatestSnapshot({ snapshots: [snapshot], tenantId: "tenant-a" });
    const contextWindow = buildDeterministicContextWindow({
      tenantId: "tenant-a",
      events: [reflection],
      snapshots: [snapshot],
      maxEvents: 25,
    });

    expect(loaded?.snapshotId).toBe(snapshot.snapshotId);
    expect(contextWindow.snapshotId).toBe(snapshot.snapshotId);
    expect(contextWindow.reflectionEventIds).toContain(reflection.id);
  });

  it("routes requests deterministically under AI isolation boundary", () => {
    const routed = routeDeterministic({
      id: "req-1",
      tenantId: "tenant-a",
      actorId: "svc",
      role: "controller",
      policyPath: "brain/read-only/router",
      traceId: "trace-1",
      timestamp: "2026-02-13T12:00:00Z",
      input: { analyze: true },
      aiResponse: {
        tenantId: "tenant-a",
        contextHash: "ctx-1",
        model: "gpt-5.3-codex",
        generatedAt: "2026-02-13T12:00:00Z",
        suggestions: [{ suggestionId: "s1", code: "OBSERVE", summary: "Observe trend", confidence: 0.9, evidenceRefs: ["ev-1"] }],
        mutationIntent: "none",
        allowedActions: ["suggest", "explain", "escalate"],
      },
    });

    expect(routed.accepted).toBe(true);
    expect(routed.intent).toBe("suggest");
    expect(routed.event.type).toBe("brain.router");
  });
});
