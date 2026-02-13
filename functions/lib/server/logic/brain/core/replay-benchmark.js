"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeReplayBenchmark = computeReplayBenchmark;
const hash_1 = require("./hash");
function computeReplayBenchmark(samples) {
    var _a;
    if (samples.length === 0) {
        return {
            avgDurationMs: 0,
            p95DurationMs: 0,
            throughputEventsPerSecond: 0,
            benchmarkHash: (0, hash_1.stableSha256Hex)({ samples: [] }),
        };
    }
    const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, value) => sum + value, 0);
    const totalEvents = samples.reduce((sum, sample) => sum + sample.eventsApplied, 0);
    const avgDurationMs = Number((totalDuration / samples.length).toFixed(4));
    const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
    const p95DurationMs = (_a = durations[p95Index]) !== null && _a !== void 0 ? _a : 0;
    const throughputEventsPerSecond = totalDuration > 0
        ? Number(((totalEvents / totalDuration) * 1000).toFixed(4))
        : 0;
    return {
        avgDurationMs,
        p95DurationMs,
        throughputEventsPerSecond,
        benchmarkHash: (0, hash_1.stableSha256Hex)({ durations, totalEvents }),
    };
}
//# sourceMappingURL=replay-benchmark.js.map