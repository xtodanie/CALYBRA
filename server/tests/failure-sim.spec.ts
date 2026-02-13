import {
  buildReflectionEvent,
  evaluateMemoryAcl,
  InMemoryAppendOnlyEventStore,
  replayDeterministic,
  routeDeterministic,
  stableSha256Hex,
  toEventHashMaterial,
  validateAIIsolationBoundary,
} from "../../server/logic/brain";

describe("Phase 1 failure simulation", () => {
  it("fails safely on corrupt event hash", () => {
    const store = new InMemoryAppendOnlyEventStore();
    const badEvent = {
      id: "evt-corrupt",
      type: "brain.router",
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "trace-1", policyPath: "brain/read-only", readOnly: true } as const,
      payload: { accepted: true },
      timestamp: "2026-02-13T09:00:00Z",
      parent_id: undefined,
      hash: "deadbeef",
    };

    expect(() => store.append(badEvent)).toThrow("invalid event envelope");
  });

  it("fails safely with missing snapshot by replaying from events", () => {
    const eventMaterial = {
      id: "evt-ok",
      type: "brain.reflection",
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "trace-2", policyPath: "brain/read-only", readOnly: true } as const,
      payload: { severity: "low" },
      timestamp: "2026-02-13T10:00:00Z",
      parent_id: undefined,
    };

    const replay = replayDeterministic({
      events: [{ ...eventMaterial, hash: stableSha256Hex(toEventHashMaterial(eventMaterial)) }],
      initialState: { total: 0 },
      reducer: (state) => ({ total: state.total + 1 }),
    });

    expect(replay.validation.valid).toBe(true);
    expect(replay.state.total).toBe(1);
  });

  it("rejects partial AI output with boundary validation", () => {
    const boundary = validateAIIsolationBoundary({
      tenantId: "tenant-a",
      contextHash: "ctx",
      model: "gpt-5.3-codex",
      generatedAt: "2026-02-13T10:30:00Z",
      suggestions: [{ suggestionId: "s1", code: "C1", summary: "", confidence: 1.2 }],
      mutationIntent: "none",
      allowedActions: ["suggest"],
    });

    expect(boundary.accepted).toBe(false);
  });

  it("contains router crash inputs by deterministic block path", () => {
    const routed = routeDeterministic({
      id: "req-block",
      tenantId: "tenant-a",
      actorId: "svc",
      role: "controller",
      policyPath: "brain/read-only/router",
      traceId: "trace-3",
      timestamp: "2026-02-13T11:00:00Z",
      input: { block: true, nested: { unsafe: true } },
    });

    expect(routed.accepted).toBe(false);
    expect(routed.reasons).toContain("blocked by deterministic router policy");
  });

  it("emits explicit reflection events instead of hidden state", () => {
    const reflection = buildReflectionEvent({
      tenantId: "tenant-a",
      traceId: "trace-4",
      actorId: "svc",
      policyPath: "brain/read-only/reflection",
      timestamp: "2026-02-13T11:30:00Z",
      indicators: { anomalyRate: 0.7, efficiencyDelta: -0.2, behaviorShift: 0.5 },
    });

    expect(reflection.type).toBe("brain.reflection");
    expect(reflection.payload["emittedAsExplicitEvent"]).toBe(true);
  });

  it("rejects duplicate event IDs in append-only store", () => {
    const store = new InMemoryAppendOnlyEventStore();
    const material = {
      id: "evt-dup",
      type: "brain.router",
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "trace-5", policyPath: "brain/read-only", readOnly: true } as const,
      payload: { accepted: true },
      timestamp: "2026-02-13T12:00:00Z",
      parent_id: undefined,
    };

    const event = { ...material, hash: stableSha256Hex(toEventHashMaterial(material)) };
    store.append(event);
    expect(() => store.append(event)).toThrow("duplicate event id");
  });

  it("fails replay validation for parent-chain discontinuity", () => {
    const base = {
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "trace-6", policyPath: "brain/read-only", readOnly: true } as const,
    };

    const firstMaterial = {
      id: "evt-a",
      type: "brain.router",
      ...base,
      payload: { accepted: true },
      timestamp: "2026-02-13T12:05:00Z",
      parent_id: undefined,
    };
    const secondMaterial = {
      id: "evt-b",
      type: "brain.reflection",
      ...base,
      payload: { severity: "low" },
      timestamp: "2026-02-13T12:05:01Z",
      parent_id: "evt-wrong",
    };

    const replay = replayDeterministic({
      events: [
        { ...firstMaterial, hash: stableSha256Hex(toEventHashMaterial(firstMaterial)) },
        { ...secondMaterial, hash: stableSha256Hex(toEventHashMaterial(secondMaterial)) },
      ],
      initialState: { total: 0 },
      reducer: (state) => ({ total: state.total + 1 }),
    });

    expect(replay.validation.valid).toBe(false);
    expect(replay.eventsApplied).toBe(0);
  });

  it("denies ACL bypass attempts deterministically", () => {
    const decision = evaluateMemoryAcl({
      tenantId: "tenant-a",
      actorTenantId: "tenant-b",
      actorRole: "viewer",
      action: "append-artifact",
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("cross-tenant");
  });

  it("normalizes timestamp variants into deterministic replay ordering", () => {
    const base = {
      actor: { tenantId: "tenant-a", actorId: "svc", actorType: "service", role: "brain" } as const,
      context: { tenantId: "tenant-a", traceId: "trace-7", policyPath: "brain/read-only", readOnly: true } as const,
    };

    const firstMaterial = {
      id: "evt-1",
      type: "brain.router",
      ...base,
      payload: { accepted: true },
      timestamp: "2026-02-13T12:10:00Z",
      parent_id: undefined,
    };
    const secondMaterial = {
      id: "evt-2",
      type: "brain.reflection",
      ...base,
      payload: { severity: "low" },
      timestamp: "2026-02-13T12:10:00.001Z",
      parent_id: "evt-1",
    };

    const events = [
      { ...secondMaterial, hash: stableSha256Hex(toEventHashMaterial(secondMaterial)) },
      { ...firstMaterial, hash: stableSha256Hex(toEventHashMaterial(firstMaterial)) },
    ];

    const replay = replayDeterministic({
      events,
      initialState: { order: [] as string[] },
      reducer: (state, event) => ({ order: [...state.order, event.id] }),
    });

    expect(replay.validation.valid).toBe(true);
    expect(replay.state.order).toEqual(["evt-1", "evt-2"]);
  });
});
