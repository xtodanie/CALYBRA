export interface RiskExposure {
  readonly financialExposure: number;
  readonly liquidityImpact: number;
  readonly volatilityRisk: number;
  readonly compositeRisk: number;
}

export function calculateRiskExposure(params: {
  amountAtRiskCents: number;
  availableLiquidityCents: number;
  volatilityIndex: number;
}): RiskExposure {
  const financialExposure = Math.min(1, Math.max(0, params.amountAtRiskCents / Math.max(1, params.availableLiquidityCents)));
  const liquidityImpact = Math.min(1, financialExposure * 0.9);
  const volatilityRisk = Math.min(1, Math.max(0, params.volatilityIndex));
  const compositeRisk = financialExposure * 0.45 + liquidityImpact * 0.25 + volatilityRisk * 0.3;
  return {
    financialExposure: Number(financialExposure.toFixed(4)),
    liquidityImpact: Number(liquidityImpact.toFixed(4)),
    volatilityRisk: Number(volatilityRisk.toFixed(4)),
    compositeRisk: Number(compositeRisk.toFixed(4)),
  };
}
