export interface ClosureScoreboardInput {
  readonly determinism: boolean;
  readonly integrity: boolean;
  readonly acl: boolean;
  readonly emulator: boolean;
  readonly preflight: boolean;
  readonly perfBudget: boolean;
}

export interface ClosureScoreboard {
  readonly score: number;
  readonly maxScore: number;
  readonly ready: boolean;
  readonly failedDimensions: readonly string[];
}

export function buildClosureScoreboard(input: ClosureScoreboardInput): ClosureScoreboard {
  const dimensions: Array<[string, boolean]> = [
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
