"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateEscalation = evaluateEscalation;
function evaluateEscalation(params) {
    if (params.financialDeviationPct > 0.2 || (params.confidence < 0.4 && params.risk > 0.7)) {
        return "escalation_critical";
    }
    if (params.financialDeviationPct > 0.12 || params.reconciliationInstability > 0.6 || params.patternConflict) {
        return "escalation_required";
    }
    if (params.financialDeviationPct > 0.07 || params.risk > 0.5) {
        return "escalation_recommended";
    }
    return null;
}
//# sourceMappingURL=escalation-engine.js.map