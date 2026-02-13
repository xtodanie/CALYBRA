import { computeNormalizedDelta } from "./delta-engine";

export interface DecisionEvaluation {
  readonly decisionId: string;
  readonly expectedDelta: number;
  readonly actualDelta: number;
  readonly success: boolean;
}

export function evaluateDecisionOutcome(params: {
  decisionId: string;
  baseline: number;
  current: number;
  expectedDelta: number;
  seasonalityFactor?: number;
}): DecisionEvaluation {
  const delta = computeNormalizedDelta({
    baseline: params.baseline,
    current: params.current,
    expectedDelta: params.expectedDelta,
    seasonalityFactor: params.seasonalityFactor,
  });
  return {
    decisionId: params.decisionId,
    expectedDelta: params.expectedDelta,
    actualDelta: delta.normalizedDelta,
    success: delta.normalizedDelta >= params.expectedDelta,
  };
}
