import {
  AIResponse,
  AIGateResult,
  BrainSnapshot,
  CanonicalEventEnvelope,
  ContextWindow,
  createSnapshot,
  buildDeterministicContextWindow,
  buildReflectionEvent,
  evaluateAIGate,
  InMemoryAppendOnlyEventStore,
  replayDeterministic,
  routeDeterministic,
  shouldCreateSnapshot,
  stableSha256Hex,
  toEventHashMaterial,
} from "../logic/brain";

export interface BrainReplayInput {
  readonly tenantId: string;
  readonly actorId: string;
  readonly actorRole: string;
  readonly policyPath: string;
  readonly traceId: string;
  readonly requestId: string;
  readonly timestamp: string;
  readonly routerInput: Readonly<Record<string, unknown>>;
  readonly aiResponse?: AIResponse;
  readonly reflectionIndicators: {
    readonly anomalyRate: number;
    readonly efficiencyDelta: number;
    readonly behaviorShift: number;
  };
  readonly snapshotPolicy?: {
    readonly interval: number;
    readonly maxRetained: number;
  };
  readonly priorEvents?: readonly CanonicalEventEnvelope[];
  readonly priorSnapshots?: readonly BrainSnapshot<BrainReplayState>[];
}

export interface BrainReplayState {
  readonly tenantId: string;
  readonly totalEvents: number;
  readonly byType: Readonly<Record<string, number>>;
  readonly lastEventId?: string;
  readonly gateAccepted: boolean;
}

export interface BrainReplayOutcome {
  readonly accepted: boolean;
  readonly intent: string;
  readonly gate: AIGateResult;
  readonly events: readonly CanonicalEventEnvelope[];
  readonly replay: {
    readonly state: BrainReplayState;
    readonly replayHash: string;
    readonly eventsApplied: number;
  };
  readonly snapshot?: BrainSnapshot<BrainReplayState>;
  readonly snapshots: readonly BrainSnapshot<BrainReplayState>[];
  readonly contextWindow: ContextWindow;
}

function plusOneMillisecondIso(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) {
    return iso;
  }
  return new Date(parsed + 1).toISOString();
}

function withParent(
  event: CanonicalEventEnvelope,
  parentId: string | undefined,
): CanonicalEventEnvelope {
  const material = {
    id: event.id,
    type: event.type,
    actor: event.actor,
    context: event.context,
    payload: event.payload,
    timestamp: event.timestamp,
    parent_id: parentId,
  };

  return {
    ...material,
    hash: stableSha256Hex(toEventHashMaterial(material)),
  };
}

function reduceReplayState(
  state: BrainReplayState,
  event: CanonicalEventEnvelope,
): BrainReplayState {
  return {
    tenantId: state.tenantId,
    totalEvents: state.totalEvents + 1,
    byType: {
      ...state.byType,
      [event.type]: (state.byType[event.type] ?? 0) + 1,
    },
    lastEventId: event.id,
    gateAccepted: state.gateAccepted,
  };
}

export function runBrainReplayWorkflow(input: BrainReplayInput): BrainReplayOutcome {
  const router = routeDeterministic({
    id: input.requestId,
    tenantId: input.tenantId,
    actorId: input.actorId,
    role: input.actorRole,
    policyPath: input.policyPath,
    traceId: input.traceId,
    timestamp: input.timestamp,
    input: input.routerInput,
    aiResponse: input.aiResponse,
  });

  const gate = input.aiResponse
    ? evaluateAIGate({
        response: input.aiResponse,
        context: {
          tenantId: input.tenantId,
          actorRole: input.actorRole,
          policyPath: input.policyPath,
          stateLocked: false,
          conflictDetected: false,
        },
      })
    : { accepted: true, reasons: [] };

  const store = new InMemoryAppendOnlyEventStore();
  if (input.priorEvents && input.priorEvents.length > 0) {
    store.appendMany(input.priorEvents);
  }

  const priorTenantEvents = store.readByTenant(input.tenantId);
  const parentId = priorTenantEvents[priorTenantEvents.length - 1]?.id;

  const routedEvent = withParent(router.event, parentId);
  store.append(routedEvent);

  const reflection = buildReflectionEvent({
    tenantId: input.tenantId,
    traceId: input.traceId,
    actorId: input.actorId,
    policyPath: input.policyPath,
    timestamp: plusOneMillisecondIso(input.timestamp),
    indicators: input.reflectionIndicators,
  });
  const chainedReflection = withParent(reflection, routedEvent.id);
  store.append(chainedReflection);

  const events = store.readByTenant(input.tenantId);
  const replay = replayDeterministic({
    events,
    initialState: (input.priorSnapshots && input.priorSnapshots.length > 0
      ? input.priorSnapshots[input.priorSnapshots.length - 1]?.state
      : {
          tenantId: input.tenantId,
          totalEvents: 0,
          byType: {},
          lastEventId: undefined,
          gateAccepted: gate.accepted,
        }) ?? {
      tenantId: input.tenantId,
      totalEvents: 0,
      byType: {},
      lastEventId: undefined,
      gateAccepted: gate.accepted,
    },
    reducer: reduceReplayState,
  });

  const policy = input.snapshotPolicy ?? { interval: 100, maxRetained: 50 };
  const snapshot = shouldCreateSnapshot({ eventCount: replay.eventsApplied, policy })
    ? createSnapshot({
        tenantId: input.tenantId,
        event: events[events.length - 1] as CanonicalEventEnvelope,
        eventIndex: replay.eventsApplied - 1,
        state: replay.state,
      })
    : undefined;

  const snapshots = [
    ...(input.priorSnapshots ?? []),
    ...(snapshot ? [snapshot] : []),
  ];

  const retainedSnapshots = snapshots
    .sort((left, right) => left.atTimestamp.localeCompare(right.atTimestamp))
    .slice(Math.max(0, snapshots.length - policy.maxRetained));

  const contextWindow = buildDeterministicContextWindow({
    tenantId: input.tenantId,
    events,
    snapshots: retainedSnapshots,
    maxEvents: 50,
  });

  return {
    accepted: router.accepted && gate.accepted,
    intent: router.intent,
    gate,
    events,
    replay: {
      state: replay.state,
      replayHash: replay.replayHash,
      eventsApplied: replay.eventsApplied,
    },
    snapshot,
    snapshots: retainedSnapshots,
    contextWindow,
  };
}
