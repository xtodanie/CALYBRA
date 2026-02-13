"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectDrift = detectDrift;
function detectDrift(params) {
    const values = [
        { type: "model_drift", score: params.modelDelta, threshold: 0.2 },
        { type: "behavioral_drift", score: params.behavioralDelta, threshold: 0.25 },
        { type: "supplier_volatility", score: params.supplierVolatility, threshold: 0.3 },
        { type: "decision_instability", score: params.decisionVariance, threshold: 0.25 },
    ];
    return values.map((entry) => ({
        driftType: entry.type,
        score: Number(entry.score.toFixed(4)),
        threshold: entry.threshold,
        triggered: entry.score >= entry.threshold,
    }));
}
//# sourceMappingURL=drift-detector.js.map