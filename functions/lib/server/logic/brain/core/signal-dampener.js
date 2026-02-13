"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dampenSignalConfidence = dampenSignalConfidence;
function dampenSignalConfidence(params) {
    const base = Math.max(0, Math.min(1, params.confidence));
    const repeatPenalty = Math.min(0.25, params.repeatedTriggers * 0.02);
    const quickResolutionPenalty = Math.min(0.35, params.quickResolutions * 0.05);
    return Number(Math.max(0, base - repeatPenalty - quickResolutionPenalty).toFixed(4));
}
//# sourceMappingURL=signal-dampener.js.map