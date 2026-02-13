"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAutonomyCircuitBreaker = evaluateAutonomyCircuitBreaker;
function evaluateAutonomyCircuitBreaker(input) {
    if (input.escalationCritical || input.healthIndex < 0.35 || input.riskExposure > 0.8) {
        return {
            tripped: true,
            forcedAutonomy: "Locked",
            reason: "critical risk containment",
        };
    }
    if (input.healthIndex < 0.55 || input.riskExposure > 0.6) {
        return {
            tripped: true,
            forcedAutonomy: "Restricted",
            reason: "degraded health containment",
        };
    }
    return {
        tripped: false,
        forcedAutonomy: input.autonomy,
        reason: "circuit nominal",
    };
}
//# sourceMappingURL=autonomy-circuit-breaker.js.map