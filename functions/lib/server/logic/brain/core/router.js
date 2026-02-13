"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeDeterministic = routeDeterministic;
const ai_response_1 = require("../contracts/ai-response");
const event_envelope_1 = require("../contracts/event-envelope");
const hash_1 = require("./hash");
function classifyIntent(request) {
    if (request.aiResponse && request.aiResponse.suggestions.length > 0) {
        return "suggest";
    }
    if (request.input["forceEscalation"] === true) {
        return "escalate";
    }
    if (request.input["block"] === true) {
        return "block";
    }
    if (request.input["analyze"] === true) {
        return "analyze";
    }
    return "observe";
}
function routeDeterministic(request) {
    var _a, _b;
    const intent = classifyIntent(request);
    const reasons = [];
    let accepted = true;
    if (request.aiResponse) {
        const boundary = (0, ai_response_1.validateAIIsolationBoundary)(request.aiResponse);
        if (!boundary.accepted) {
            accepted = false;
            reasons.push(...boundary.reasons);
        }
    }
    if (intent === "block") {
        accepted = false;
        reasons.push("blocked by deterministic router policy");
    }
    const payload = {
        requestId: request.id,
        intent,
        accepted,
        reasons,
        input: request.input,
        aiSuggestionCount: (_b = (_a = request.aiResponse) === null || _a === void 0 ? void 0 : _a.suggestions.length) !== null && _b !== void 0 ? _b : 0,
    };
    const eventMaterial = {
        id: `router:${request.id}`,
        type: "brain.router",
        actor: {
            tenantId: request.tenantId,
            actorId: request.actorId,
            actorType: request.aiResponse ? "ai" : "service",
            role: request.role,
        },
        context: {
            tenantId: request.tenantId,
            traceId: request.traceId,
            policyPath: request.policyPath,
            readOnly: true,
        },
        payload,
        timestamp: request.timestamp,
        parent_id: undefined,
    };
    const event = Object.assign(Object.assign({}, eventMaterial), { hash: (0, hash_1.stableSha256Hex)((0, event_envelope_1.toEventHashMaterial)(eventMaterial)) });
    return { intent, accepted, reasons, event };
}
//# sourceMappingURL=router.js.map