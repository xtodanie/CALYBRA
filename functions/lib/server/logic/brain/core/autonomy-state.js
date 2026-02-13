"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transitionAutonomyState = transitionAutonomyState;
function transitionAutonomyState(params) {
    if (params.roiNegative || params.consecutiveMisfires >= 3 || params.riskExposure > 0.8) {
        return "Locked";
    }
    if (params.accuracyScore < 0.45 || params.driftTriggered || params.riskExposure > 0.6) {
        return "Restricted";
    }
    if (params.accuracyScore < 0.7 || params.riskExposure > 0.35) {
        return "Assisted";
    }
    return params.current === "Locked" ? "Restricted" : "Advisory";
}
//# sourceMappingURL=autonomy-state.js.map