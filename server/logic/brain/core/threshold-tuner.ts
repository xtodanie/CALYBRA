export interface ThresholdTuningInput {
  readonly currentThreshold: number;
  readonly observedSuccessRate: number;
  readonly targetSuccessRate: number;
  readonly maxAdjustmentStep: number;
  readonly minBound: number;
  readonly maxBound: number;
}

export interface ThresholdTuningResult {
  readonly nextThreshold: number;
  readonly adjustment: number;
}

export function tuneThresholdBounded(input: ThresholdTuningInput): ThresholdTuningResult {
  const current = Math.max(input.minBound, Math.min(input.maxBound, input.currentThreshold));
  const observed = Math.max(0, Math.min(1, input.observedSuccessRate));
  const target = Math.max(0, Math.min(1, input.targetSuccessRate));
  const gap = target - observed;
  const adjustment = Math.max(-input.maxAdjustmentStep, Math.min(input.maxAdjustmentStep, gap * 0.5));
  const next = Math.max(input.minBound, Math.min(input.maxBound, current - adjustment));

  return {
    nextThreshold: Number(next.toFixed(4)),
    adjustment: Number(adjustment.toFixed(4)),
  };
}
