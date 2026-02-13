export type DriftType = "model_drift" | "behavioral_drift" | "supplier_volatility" | "decision_instability";

export interface DriftSignal {
  readonly driftType: DriftType;
  readonly score: number;
  readonly threshold: number;
  readonly triggered: boolean;
}

export function detectDrift(params: {
  modelDelta: number;
  behavioralDelta: number;
  supplierVolatility: number;
  decisionVariance: number;
}): readonly DriftSignal[] {
  const values: Array<{ type: DriftType; score: number; threshold: number }> = [
    { type: "model_drift", score: params.modelDelta, threshold: 0.2 },
    { type: "behavioral_drift", score: params.behavioralDelta, threshold: 0.25 },
    { type: "supplier_volatility", score: params.supplierVolatility, threshold: 0.3 },
    { type: "decision_instability", score: params.decisionVariance, threshold: 0.25 },
  ];
  return values.map((entry) => ({
    driftType: entry.type,
    score: Number(entry.score.toFixed(4)),
    threshold: entry.threshold,
    triggered: entry.score >= entry.threshold,
  }));
}
