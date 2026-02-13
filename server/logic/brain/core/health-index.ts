export interface IntelligenceHealthInput {
  readonly predictionAccuracy: number;
  readonly roiDelta: number;
  readonly driftRate: number;
  readonly falsePositiveRate: number;
  readonly autonomyStability: number;
}

export function computeIntelligenceHealthIndex(input: IntelligenceHealthInput): number {
  const prediction = Math.max(0, Math.min(1, input.predictionAccuracy));
  const roi = Math.max(0, Math.min(1, (input.roiDelta + 1) / 2));
  const driftPenalty = 1 - Math.max(0, Math.min(1, input.driftRate));
  const fpPenalty = 1 - Math.max(0, Math.min(1, input.falsePositiveRate));
  const stability = Math.max(0, Math.min(1, input.autonomyStability));
  const score = prediction * 0.3 + roi * 0.25 + driftPenalty * 0.2 + fpPenalty * 0.15 + stability * 0.1;
  return Number(score.toFixed(4));
}

export interface DegradationContainmentAction {
  readonly restrictAutonomy: boolean;
  readonly escalateSensitivity: "normal" | "elevated" | "critical";
  readonly freezeStrategicSuggestions: boolean;
}

export function resolveDegradationContainment(healthIndex: number): DegradationContainmentAction {
  if (healthIndex < 0.35) {
    return {
      restrictAutonomy: true,
      escalateSensitivity: "critical",
      freezeStrategicSuggestions: true,
    };
  }
  if (healthIndex < 0.55) {
    return {
      restrictAutonomy: true,
      escalateSensitivity: "elevated",
      freezeStrategicSuggestions: false,
    };
  }
  return {
    restrictAutonomy: false,
    escalateSensitivity: "normal",
    freezeStrategicSuggestions: false,
  };
}
