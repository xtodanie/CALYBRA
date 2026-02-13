import { stableSha256Hex } from "./hash";

export interface ReplayHashSample {
  readonly runId: string;
  readonly replayHash: string;
  readonly eventsApplied: number;
}

export interface ReplayDiffAnalysis {
  readonly stable: boolean;
  readonly baselineHash: string;
  readonly divergentRuns: readonly string[];
  readonly summaryHash: string;
}

export function analyzeReplayDiff(samples: readonly ReplayHashSample[]): ReplayDiffAnalysis {
  if (samples.length === 0) {
    const hash = stableSha256Hex({ samples: [] });
    return {
      stable: true,
      baselineHash: "",
      divergentRuns: [],
      summaryHash: hash,
    };
  }

  const baseline = samples[0] as ReplayHashSample;
  const divergentRuns = samples
    .filter((sample) => sample.replayHash !== baseline.replayHash)
    .map((sample) => sample.runId)
    .sort((a, b) => a.localeCompare(b));

  const summaryHash = stableSha256Hex({
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
