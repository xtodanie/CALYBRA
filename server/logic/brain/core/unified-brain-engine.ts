import { transitionAutonomyState, AutonomyState } from "./autonomy-state";
import { computeIntelligenceHealthIndex, resolveDegradationContainment } from "./health-index";
import { evaluateEscalation } from "./escalation-engine";

export interface UnifiedBrainInput {
  readonly currentAutonomy: AutonomyState;
  readonly accuracyScore: number;
  readonly driftTriggered: boolean;
  readonly riskExposure: number;
  readonly consecutiveMisfires: number;
  readonly roiNegative: boolean;
  readonly financialDeviationPct: number;
  readonly reconciliationInstability: number;
  readonly patternConflict: boolean;
  readonly confidence: number;
  readonly predictionAccuracy: number;
  readonly roiDelta: number;
  readonly driftRate: number;
  readonly falsePositiveRate: number;
  readonly autonomyStability: number;
}

export interface UnifiedBrainOutcome {
  readonly autonomy: AutonomyState;
  readonly healthIndex: number;
  readonly containment: ReturnType<typeof resolveDegradationContainment>;
  readonly escalation: ReturnType<typeof evaluateEscalation>;
}

export function runUnifiedBrainEngine(input: UnifiedBrainInput): UnifiedBrainOutcome {
  const autonomy = transitionAutonomyState({
    current: input.currentAutonomy,
    accuracyScore: input.accuracyScore,
    driftTriggered: input.driftTriggered,
    riskExposure: input.riskExposure,
    consecutiveMisfires: input.consecutiveMisfires,
    roiNegative: input.roiNegative,
  });

  const healthIndex = computeIntelligenceHealthIndex({
    predictionAccuracy: input.predictionAccuracy,
    roiDelta: input.roiDelta,
    driftRate: input.driftRate,
    falsePositiveRate: input.falsePositiveRate,
    autonomyStability: input.autonomyStability,
  });

  const containment = resolveDegradationContainment(healthIndex);
  const escalation = evaluateEscalation({
    financialDeviationPct: input.financialDeviationPct,
    reconciliationInstability: input.reconciliationInstability,
    patternConflict: input.patternConflict,
    confidence: input.confidence,
    risk: input.riskExposure,
  });

  return {
    autonomy,
    healthIndex,
    containment,
    escalation,
  };
}
