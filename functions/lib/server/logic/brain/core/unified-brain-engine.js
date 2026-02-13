"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runUnifiedBrainEngine = runUnifiedBrainEngine;
const autonomy_state_1 = require("./autonomy-state");
const health_index_1 = require("./health-index");
const escalation_engine_1 = require("./escalation-engine");
function runUnifiedBrainEngine(input) {
    const autonomy = (0, autonomy_state_1.transitionAutonomyState)({
        current: input.currentAutonomy,
        accuracyScore: input.accuracyScore,
        driftTriggered: input.driftTriggered,
        riskExposure: input.riskExposure,
        consecutiveMisfires: input.consecutiveMisfires,
        roiNegative: input.roiNegative,
    });
    const healthIndex = (0, health_index_1.computeIntelligenceHealthIndex)({
        predictionAccuracy: input.predictionAccuracy,
        roiDelta: input.roiDelta,
        driftRate: input.driftRate,
        falsePositiveRate: input.falsePositiveRate,
        autonomyStability: input.autonomyStability,
    });
    const containment = (0, health_index_1.resolveDegradationContainment)(healthIndex);
    const escalation = (0, escalation_engine_1.evaluateEscalation)({
        financialDeviationPct: input.financialDeviationPct,
        reconciliationInstability: input.reconciliationInstability,
        patternConflict: input.patternConflict,
        confidence: input.confidence,
        risk: input.riskExposure,
    });
    return {
        autonomy,
        healthIndex,
        containment,
        escalation,
    };
}
//# sourceMappingURL=unified-brain-engine.js.map