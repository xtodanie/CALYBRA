"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditPrediction = auditPrediction;
function auditPrediction(params) {
    const accuracyDelta = Math.abs(params.actualDelta - params.predictedDelta);
    return {
        decisionId: params.decisionId,
        predictedDelta: params.predictedDelta,
        actualDelta: params.actualDelta,
        accuracyDelta: Number(accuracyDelta.toFixed(6)),
    };
}
//# sourceMappingURL=prediction-audit.js.map