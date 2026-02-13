"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateFreezeCandidate = evaluateFreezeCandidate;
function evaluateFreezeCandidate(scoreboard) {
    if (scoreboard.ready) {
        return {
            approved: true,
            recommendation: "freeze",
            reasons: ["all closure dimensions passed"],
        };
    }
    return {
        approved: false,
        recommendation: "hold",
        reasons: scoreboard.failedDimensions,
    };
}
//# sourceMappingURL=freeze-candidate.js.map