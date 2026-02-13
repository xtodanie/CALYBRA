import { stableSha256Hex } from "./hash";

export interface ReplayBenchmarkSample {
  readonly runId: string;
  readonly durationMs: number;
  readonly eventsApplied: number;
}

export interface ReplayBenchmarkResult {
  readonly avgDurationMs: number;
  readonly p95DurationMs: number;
  readonly throughputEventsPerSecond: number;
  readonly benchmarkHash: string;
}

export function computeReplayBenchmark(samples: readonly ReplayBenchmarkSample[]): ReplayBenchmarkResult {
  if (samples.length === 0) {
    return {
      avgDurationMs: 0,
      p95DurationMs: 0,
      throughputEventsPerSecond: 0,
      benchmarkHash: stableSha256Hex({ samples: [] }),
    };
  }

  const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, value) => sum + value, 0);
  const totalEvents = samples.reduce((sum, sample) => sum + sample.eventsApplied, 0);
  const avgDurationMs = Number((totalDuration / samples.length).toFixed(4));
  const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95));
  const p95DurationMs = durations[p95Index] ?? 0;
  const throughputEventsPerSecond = totalDuration > 0
    ? Number(((totalEvents / totalDuration) * 1000).toFixed(4))
    : 0;

  return {
    avgDurationMs,
    p95DurationMs,
    throughputEventsPerSecond,
    benchmarkHash: stableSha256Hex({ durations, totalEvents }),
  };
}
