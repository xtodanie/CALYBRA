export interface PredictionAuditResult {
  readonly decisionId: string;
  readonly predictedDelta: number;
  readonly actualDelta: number;
  readonly accuracyDelta: number;
}

export function auditPrediction(params: {
  decisionId: string;
  predictedDelta: number;
  actualDelta: number;
}): PredictionAuditResult {
  const accuracyDelta = Math.abs(params.actualDelta - params.predictedDelta);
  return {
    decisionId: params.decisionId,
    predictedDelta: params.predictedDelta,
    actualDelta: params.actualDelta,
    accuracyDelta: Number(accuracyDelta.toFixed(6)),
  };
}
