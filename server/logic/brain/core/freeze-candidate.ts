import { ClosureScoreboard } from "./closure-scoreboard";

export interface FreezeCandidateResult {
  readonly approved: boolean;
  readonly recommendation: "freeze" | "hold";
  readonly reasons: readonly string[];
}

export function evaluateFreezeCandidate(scoreboard: ClosureScoreboard): FreezeCandidateResult {
  if (scoreboard.ready) {
    return {
      approved: true,
      recommendation: "freeze",
      reasons: ["all closure dimensions passed"],
    };
  }

  return {
    approved: false,
    recommendation: "hold",
    reasons: scoreboard.failedDimensions,
  };
}
