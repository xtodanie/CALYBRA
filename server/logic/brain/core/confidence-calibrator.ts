export interface CalibrationInput {
  readonly baselineConfidence: number;
  readonly predictionAccuracy: number;
  readonly falsePositiveRate: number;
}

export interface CalibrationOutput {
  readonly adjustedConfidence: number;
  readonly shouldRestrictAutonomy: boolean;
}

export function calibrateConfidence(input: CalibrationInput): CalibrationOutput {
  const penalty = (1 - input.predictionAccuracy) * 0.5 + input.falsePositiveRate * 0.5;
  const adjustedConfidence = Math.max(0, Math.min(1, input.baselineConfidence - penalty));
  return {
    adjustedConfidence: Number(adjustedConfidence.toFixed(4)),
    shouldRestrictAutonomy: adjustedConfidence < 0.45,
  };
}
