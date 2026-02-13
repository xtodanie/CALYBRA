"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAIGate = evaluateAIGate;
const ai_response_1 = require("../contracts/ai-response");
const ALLOWED_ROLES = new Set(["owner", "admin", "auditor", "controller"]);
function evaluateAIGate(params) {
    const reasons = [];
    const boundary = (0, ai_response_1.validateAIIsolationBoundary)(params.response);
    if (!boundary.accepted) {
        reasons.push(...boundary.reasons);
    }
    if (params.response.tenantId !== params.context.tenantId) {
        reasons.push("tenant mismatch");
    }
    if (!ALLOWED_ROLES.has(params.context.actorRole)) {
        reasons.push("actor role is not allowed for AI suggestion intake");
    }
    if (params.context.stateLocked) {
        reasons.push("state is locked");
    }
    if (params.context.conflictDetected) {
        reasons.push("conflict detected");
    }
    if (!params.context.policyPath.includes("read-only")) {
        reasons.push("policyPath must enforce read-only boundary");
    }
    return {
        accepted: reasons.length === 0,
        reasons,
    };
}
//# sourceMappingURL=ai-gate.js.map