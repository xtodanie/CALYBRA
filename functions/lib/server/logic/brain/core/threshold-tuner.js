"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tuneThresholdBounded = tuneThresholdBounded;
function tuneThresholdBounded(input) {
    const current = Math.max(input.minBound, Math.min(input.maxBound, input.currentThreshold));
    const observed = Math.max(0, Math.min(1, input.observedSuccessRate));
    const target = Math.max(0, Math.min(1, input.targetSuccessRate));
    const gap = target - observed;
    const adjustment = Math.max(-input.maxAdjustmentStep, Math.min(input.maxAdjustmentStep, gap * 0.5));
    const next = Math.max(input.minBound, Math.min(input.maxBound, current - adjustment));
    return {
        nextThreshold: Number(next.toFixed(4)),
        adjustment: Number(adjustment.toFixed(4)),
    };
}
//# sourceMappingURL=threshold-tuner.js.map