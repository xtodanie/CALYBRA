import { analyzeReplayDiff, ReplayHashSample } from "./replay-diff-analyzer";

export interface DeterminismAuditInput {
  readonly runLabel: string;
  readonly samples: readonly ReplayHashSample[];
}

export interface DeterminismAuditResult {
  readonly runLabel: string;
  readonly passed: boolean;
  readonly baselineHash: string;
  readonly divergentRuns: readonly string[];
}

export function runDeterminismAudit(input: DeterminismAuditInput): DeterminismAuditResult {
  const analysis = analyzeReplayDiff(input.samples);
  return {
    runLabel: input.runLabel,
    passed: analysis.stable,
    baselineHash: analysis.baselineHash,
    divergentRuns: analysis.divergentRuns,
  };
}
