"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calibrateConfidence = calibrateConfidence;
function calibrateConfidence(input) {
    const penalty = (1 - input.predictionAccuracy) * 0.5 + input.falsePositiveRate * 0.5;
    const adjustedConfidence = Math.max(0, Math.min(1, input.baselineConfidence - penalty));
    return {
        adjustedConfidence: Number(adjustedConfidence.toFixed(4)),
        shouldRestrictAutonomy: adjustedConfidence < 0.45,
    };
}
//# sourceMappingURL=confidence-calibrator.js.map