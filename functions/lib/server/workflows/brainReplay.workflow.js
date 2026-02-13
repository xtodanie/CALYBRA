"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBrainReplayWorkflow = runBrainReplayWorkflow;
const brain_1 = require("../logic/brain");
function plusOneMillisecondIso(iso) {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
        return iso;
    }
    return new Date(parsed + 1).toISOString();
}
function withParent(event, parentId) {
    const material = {
        id: event.id,
        type: event.type,
        actor: event.actor,
        context: event.context,
        payload: event.payload,
        timestamp: event.timestamp,
        parent_id: parentId,
    };
    return Object.assign(Object.assign({}, material), { hash: (0, brain_1.stableSha256Hex)((0, brain_1.toEventHashMaterial)(material)) });
}
function reduceReplayState(state, event) {
    var _a;
    return {
        tenantId: state.tenantId,
        totalEvents: state.totalEvents + 1,
        byType: Object.assign(Object.assign({}, state.byType), { [event.type]: ((_a = state.byType[event.type]) !== null && _a !== void 0 ? _a : 0) + 1 }),
        lastEventId: event.id,
        gateAccepted: state.gateAccepted,
    };
}
function runBrainReplayWorkflow(input) {
    var _a, _b, _c, _d, _e;
    const router = (0, brain_1.routeDeterministic)({
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
        ? (0, brain_1.evaluateAIGate)({
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
    const store = new brain_1.InMemoryAppendOnlyEventStore();
    if (input.priorEvents && input.priorEvents.length > 0) {
        store.appendMany(input.priorEvents);
    }
    const priorTenantEvents = store.readByTenant(input.tenantId);
    const parentId = (_a = priorTenantEvents[priorTenantEvents.length - 1]) === null || _a === void 0 ? void 0 : _a.id;
    const routedEvent = withParent(router.event, parentId);
    store.append(routedEvent);
    const reflection = (0, brain_1.buildReflectionEvent)({
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
    const replay = (0, brain_1.replayDeterministic)({
        events,
        initialState: (_c = (input.priorSnapshots && input.priorSnapshots.length > 0
            ? (_b = input.priorSnapshots[input.priorSnapshots.length - 1]) === null || _b === void 0 ? void 0 : _b.state
            : {
                tenantId: input.tenantId,
                totalEvents: 0,
                byType: {},
                lastEventId: undefined,
                gateAccepted: gate.accepted,
            })) !== null && _c !== void 0 ? _c : {
            tenantId: input.tenantId,
            totalEvents: 0,
            byType: {},
            lastEventId: undefined,
            gateAccepted: gate.accepted,
        },
        reducer: reduceReplayState,
    });
    const policy = (_d = input.snapshotPolicy) !== null && _d !== void 0 ? _d : { interval: 100, maxRetained: 50 };
    const snapshot = (0, brain_1.shouldCreateSnapshot)({ eventCount: replay.eventsApplied, policy })
        ? (0, brain_1.createSnapshot)({
            tenantId: input.tenantId,
            event: events[events.length - 1],
            eventIndex: replay.eventsApplied - 1,
            state: replay.state,
        })
        : undefined;
    const snapshots = [
        ...((_e = input.priorSnapshots) !== null && _e !== void 0 ? _e : []),
        ...(snapshot ? [snapshot] : []),
    ];
    const retainedSnapshots = snapshots
        .sort((left, right) => left.atTimestamp.localeCompare(right.atTimestamp))
        .slice(Math.max(0, snapshots.length - policy.maxRetained));
    const contextWindow = (0, brain_1.buildDeterministicContextWindow)({
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
//# sourceMappingURL=brainReplay.workflow.js.map