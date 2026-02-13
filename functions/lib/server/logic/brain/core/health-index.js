"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeIntelligenceHealthIndex = computeIntelligenceHealthIndex;
exports.resolveDegradationContainment = resolveDegradationContainment;
function computeIntelligenceHealthIndex(input) {
    const prediction = Math.max(0, Math.min(1, input.predictionAccuracy));
    const roi = Math.max(0, Math.min(1, (input.roiDelta + 1) / 2));
    const driftPenalty = 1 - Math.max(0, Math.min(1, input.driftRate));
    const fpPenalty = 1 - Math.max(0, Math.min(1, input.falsePositiveRate));
    const stability = Math.max(0, Math.min(1, input.autonomyStability));
    const score = prediction * 0.3 + roi * 0.25 + driftPenalty * 0.2 + fpPenalty * 0.15 + stability * 0.1;
    return Number(score.toFixed(4));
}
function resolveDegradationContainment(healthIndex) {
    if (healthIndex < 0.35) {
        return {
            restrictAutonomy: true,
            escalateSensitivity: "critical",
            freezeStrategicSuggestions: true,
        };
    }
    if (healthIndex < 0.55) {
        return {
            restrictAutonomy: true,
            escalateSensitivity: "elevated",
            freezeStrategicSuggestions: false,
        };
    }
    return {
        restrictAutonomy: false,
        escalateSensitivity: "normal",
        freezeStrategicSuggestions: false,
    };
}
//# sourceMappingURL=health-index.js.map