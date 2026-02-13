export interface PerformancePoint {
  readonly atIso: string;
  readonly improvementCompounding: number;
  readonly riskReductionTrend: number;
  readonly decisionAccuracyTrend: number;
}

export function buildPerformanceGraph(points: readonly PerformancePoint[]): readonly PerformancePoint[] {
  return [...points].sort((a, b) => a.atIso.localeCompare(b.atIso));
}
