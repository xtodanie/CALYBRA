export function computeNormalizedDelta(params: {
  baseline: number;
  current: number;
  expectedDelta: number;
  seasonalityFactor?: number;
}): {
  readonly actualDelta: number;
  readonly normalizedDelta: number;
  readonly expectedDelta: number;
} {
  if (params.baseline === 0) {
    return { actualDelta: 0, normalizedDelta: 0, expectedDelta: params.expectedDelta };
  }
  const actualDelta = (params.current - params.baseline) / params.baseline;
  const seasonality = params.seasonalityFactor ?? 1;
  const normalizedDelta = actualDelta / (seasonality === 0 ? 1 : seasonality);
  return {
    actualDelta: Number(actualDelta.toFixed(6)),
    normalizedDelta: Number(normalizedDelta.toFixed(6)),
    expectedDelta: params.expectedDelta,
  };
}
