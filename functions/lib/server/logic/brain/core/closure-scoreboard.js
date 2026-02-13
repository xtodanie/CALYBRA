"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildClosureScoreboard = buildClosureScoreboard;
function buildClosureScoreboard(input) {
    const dimensions = [
        ["determinism", input.determinism],
        ["integrity", input.integrity],
        ["acl", input.acl],
        ["emulator", input.emulator],
        ["preflight", input.preflight],
        ["perfBudget", input.perfBudget],
    ];
    const score = dimensions.filter(([, passed]) => passed).length;
    const failedDimensions = dimensions.filter(([, passed]) => !passed).map(([name]) => name);
    return {
        score,
        maxScore: dimensions.length,
        ready: failedDimensions.length === 0,
        failedDimensions,
    };
}
//# sourceMappingURL=closure-scoreboard.js.map