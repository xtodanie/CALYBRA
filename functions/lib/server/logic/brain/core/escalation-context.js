"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildEscalationContext = buildEscalationContext;
function buildEscalationContext(input) {
    return {
        decisionHistory: [...input.decisionHistory],
        patternChain: [...input.patternChain],
        riskSummary: Object.assign({}, input.riskSummary),
        expectationDelta: Object.assign({}, input.expectationDelta),
    };
}
//# sourceMappingURL=escalation-context.js.map