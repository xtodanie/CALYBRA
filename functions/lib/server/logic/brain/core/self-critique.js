"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSelfCritiqueEvents = emitSelfCritiqueEvents;
function emitSelfCritiqueEvents(params) {
    const events = [];
    if (params.predictionAccuracy < 0.55) {
        events.push({ type: "intelligence_degraded", score: Number((1 - params.predictionAccuracy).toFixed(4)), atIso: params.atIso });
    }
    if (params.decisionMisfired) {
        events.push({ type: "decision_misfire", score: 1, atIso: params.atIso });
    }
    if (params.patternFalsePositive || params.falsePositiveRate > 0.25) {
        events.push({ type: "pattern_false_positive", score: Number(params.falsePositiveRate.toFixed(4)), atIso: params.atIso });
    }
    if (params.confidence < 0.45) {
        events.push({ type: "confidence_drop", score: Number((0.45 - params.confidence).toFixed(4)), atIso: params.atIso });
    }
    return events;
}
//# sourceMappingURL=self-critique.js.map