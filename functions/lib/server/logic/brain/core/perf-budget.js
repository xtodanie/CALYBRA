"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluatePerformanceBudget = evaluatePerformanceBudget;
function evaluatePerformanceBudget(benchmark, budget) {
    const reasons = [];
    if (benchmark.avgDurationMs > budget.maxAvgDurationMs) {
        reasons.push("avg duration exceeds budget");
    }
    if (benchmark.p95DurationMs > budget.maxP95DurationMs) {
        reasons.push("p95 duration exceeds budget");
    }
    if (benchmark.throughputEventsPerSecond < budget.minThroughputEventsPerSecond) {
        reasons.push("throughput below budget");
    }
    return { passed: reasons.length === 0, reasons };
}
//# sourceMappingURL=perf-budget.js.map