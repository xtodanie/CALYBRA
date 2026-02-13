export interface DecisionQualityInput {
  readonly roi: number;
  readonly confidence: number;
  readonly riskPenalty: number;
  readonly overridePenalty: number;
  readonly driftPenalty: number;
}

export interface DecisionQualityScore {
  readonly score: number;
  readonly grade: "A" | "B" | "C" | "D";
}

export function scoreDecisionQualityV2(input: DecisionQualityInput): DecisionQualityScore {
  const roi = Math.max(-1, Math.min(1, input.roi));
  const confidence = Math.max(0, Math.min(1, input.confidence));
  const riskPenalty = Math.max(0, Math.min(1, input.riskPenalty));
  const overridePenalty = Math.max(0, Math.min(1, input.overridePenalty));
  const driftPenalty = Math.max(0, Math.min(1, input.driftPenalty));

  const raw = 0.45 * ((roi + 1) / 2)
    + 0.35 * confidence
    - 0.1 * riskPenalty
    - 0.05 * overridePenalty
    - 0.05 * driftPenalty;

  const score = Number(Math.max(0, Math.min(1, raw)).toFixed(4));
  const grade = score >= 0.85 ? "A" : score >= 0.7 ? "B" : score >= 0.55 ? "C" : "D";

  return { score, grade };
}
