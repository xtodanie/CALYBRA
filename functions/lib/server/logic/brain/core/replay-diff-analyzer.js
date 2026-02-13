"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeReplayDiff = analyzeReplayDiff;
const hash_1 = require("./hash");
function analyzeReplayDiff(samples) {
    if (samples.length === 0) {
        const hash = (0, hash_1.stableSha256Hex)({ samples: [] });
        return {
            stable: true,
            baselineHash: "",
            divergentRuns: [],
            summaryHash: hash,
        };
    }
    const baseline = samples[0];
    const divergentRuns = samples
        .filter((sample) => sample.replayHash !== baseline.replayHash)
        .map((sample) => sample.runId)
        .sort((a, b) => a.localeCompare(b));
    const summaryHash = (0, hash_1.stableSha256Hex)({
        baselineHash: baseline.replayHash,
        divergentRuns,
        eventsApplied: samples.map((sample) => sample.eventsApplied),
    });
    return {
        stable: divergentRuns.length === 0,
        baselineHash: baseline.replayHash,
        divergentRuns,
        summaryHash,
    };
}
//# sourceMappingURL=replay-diff-analyzer.js.map