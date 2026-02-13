export function dampenSignalConfidence(params: {
  confidence: number;
  repeatedTriggers: number;
  quickResolutions: number;
}): number {
  const base = Math.max(0, Math.min(1, params.confidence));
  const repeatPenalty = Math.min(0.25, params.repeatedTriggers * 0.02);
  const quickResolutionPenalty = Math.min(0.35, params.quickResolutions * 0.05);
  return Number(Math.max(0, base - repeatPenalty - quickResolutionPenalty).toFixed(4));
}
