"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeterminismAudit = runDeterminismAudit;
const replay_diff_analyzer_1 = require("./replay-diff-analyzer");
function runDeterminismAudit(input) {
    const analysis = (0, replay_diff_analyzer_1.analyzeReplayDiff)(input.samples);
    return {
        runLabel: input.runLabel,
        passed: analysis.stable,
        baselineHash: analysis.baselineHash,
        divergentRuns: analysis.divergentRuns,
    };
}
//# sourceMappingURL=determinism-audit.js.map