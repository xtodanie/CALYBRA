import { ReplayBenchmarkResult } from "./replay-benchmark";

export interface PerformanceBudget {
  readonly maxAvgDurationMs: number;
  readonly maxP95DurationMs: number;
  readonly minThroughputEventsPerSecond: number;
}

export interface PerformanceBudgetResult {
  readonly passed: boolean;
  readonly reasons: readonly string[];
}

export function evaluatePerformanceBudget(
  benchmark: ReplayBenchmarkResult,
  budget: PerformanceBudget,
): PerformanceBudgetResult {
  const reasons: string[] = [];
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
