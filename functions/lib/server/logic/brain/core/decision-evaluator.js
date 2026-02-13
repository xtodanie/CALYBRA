"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateDecisionOutcome = evaluateDecisionOutcome;
const delta_engine_1 = require("./delta-engine");
function evaluateDecisionOutcome(params) {
    const delta = (0, delta_engine_1.computeNormalizedDelta)({
        baseline: params.baseline,
        current: params.current,
        expectedDelta: params.expectedDelta,
        seasonalityFactor: params.seasonalityFactor,
    });
    return {
        decisionId: params.decisionId,
        expectedDelta: params.expectedDelta,
        actualDelta: delta.normalizedDelta,
        success: delta.normalizedDelta >= params.expectedDelta,
    };
}
//# sourceMappingURL=decision-evaluator.js.map