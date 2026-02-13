export function scoreSignalConfidence(params: {
  evidenceCount: number;
  timeWeight: number;
  driftMagnitude: number;
  historicalStability: number;
}): number {
  const evidence = Math.min(1, params.evidenceCount / 10);
  const timeWeight = Math.max(0, Math.min(1, params.timeWeight));
  const drift = Math.min(1, params.driftMagnitude);
  const stability = Math.max(0, Math.min(1, params.historicalStability));
  const confidence = 0.35 * evidence + 0.2 * timeWeight + 0.3 * drift + 0.15 * stability;
  return Number(confidence.toFixed(4));
}
