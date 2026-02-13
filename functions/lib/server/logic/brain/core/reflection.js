"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildReflectionEvent = buildReflectionEvent;
const event_envelope_1 = require("../contracts/event-envelope");
const hash_1 = require("./hash");
function buildReflectionEvent(input) {
    const severity = input.indicators.anomalyRate >= 0.5 || input.indicators.behaviorShift >= 0.5
        ? "high"
        : input.indicators.anomalyRate >= 0.2 || input.indicators.behaviorShift >= 0.2
            ? "medium"
            : "low";
    const material = {
        id: `reflection:${(0, hash_1.stableSha256Hex)({
            tenantId: input.tenantId,
            traceId: input.traceId,
            actorId: input.actorId,
            timestamp: input.timestamp,
        }).slice(0, 24)}`,
        type: "brain.reflection",
        actor: {
            tenantId: input.tenantId,
            actorId: input.actorId,
            actorType: "service",
            role: "brain-reflection",
        },
        context: {
            tenantId: input.tenantId,
            traceId: input.traceId,
            policyPath: input.policyPath,
            readOnly: true,
        },
        payload: {
            severity,
            anomalyRate: input.indicators.anomalyRate,
            efficiencyDelta: input.indicators.efficiencyDelta,
            behaviorShift: input.indicators.behaviorShift,
            emittedAsExplicitEvent: true,
        },
        timestamp: input.timestamp,
        parent_id: undefined,
    };
    return Object.assign(Object.assign({}, material), { hash: (0, hash_1.stableSha256Hex)((0, event_envelope_1.toEventHashMaterial)(material)) });
}
//# sourceMappingURL=reflection.js.map