"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreDecisionQualityV2 = scoreDecisionQualityV2;
function scoreDecisionQualityV2(input) {
    const roi = Math.max(-1, Math.min(1, input.roi));
    const confidence = Math.max(0, Math.min(1, input.confidence));
    const riskPenalty = Math.max(0, Math.min(1, input.riskPenalty));
    const overridePenalty = Math.max(0, Math.min(1, input.overridePenalty));
    const driftPenalty = Math.max(0, Math.min(1, input.driftPenalty));
    const raw = 0.45 * ((roi + 1) / 2)
        + 0.35 * confidence
        - 0.1 * riskPenalty
        - 0.05 * overridePenalty
        - 0.05 * driftPenalty;
    const score = Number(Math.max(0, Math.min(1, raw)).toFixed(4));
    const grade = score >= 0.85 ? "A" : score >= 0.7 ? "B" : score >= 0.55 ? "C" : "D";
    return { score, grade };
}
//# sourceMappingURL=decision-scorer-v2.js.map